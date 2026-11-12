"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getContexto } from "@/lib/contexto";
import { diffDias, hoje, isDia, paraDate, paraDia } from "@/lib/datas";
import { arred, parseValor } from "@/lib/dinheiro";

export type Resultado = { ok: true } | { erro: string };

/** Funcionário lança só nos últimos dias e enquanto o caixa do dia não foi fechado. */
const DIAS_FUNCIONARIO = 7;

class Negado extends Error {}

async function autorizar(filialId: string, dia: string) {
  const ctx = await getContexto();
  if (!ctx.filiais.some((f) => f.id === filialId)) throw new Negado("Você não tem acesso a esta filial.");
  if (!isDia(dia)) throw new Negado("Data inválida.");
  if (!ctx.gestor) {
    const d = diffDias(hoje(), dia);
    if (d < 0 || d > DIAS_FUNCIONARIO) throw new Negado("Só o gestor pode lançar nesta data.");
    const cx = await prisma.caixaDia.findUnique({ where: { filialId_data: { filialId, data: paraDate(dia) } } });
    if (cx?.fechado) throw new Negado("O caixa deste dia já foi fechado. Peça ao gestor para reabrir.");
  }
  return ctx;
}

async function executar(fn: () => Promise<void>): Promise<Resultado> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Negado) return { erro: e.message };
    if (e instanceof z.ZodError) return { erro: e.issues[0]?.message ?? "Dados inválidos." };
    throw e;
  }
}

const valor = (msg = "Informe o valor.") =>
  z.preprocess(parseValor, z.number({ invalid_type_error: msg }).nonnegative(msg).max(9_999_999));
const qtd = z.coerce.number({ invalid_type_error: "Informe a quantidade." }).int().min(1, "Informe a quantidade.").max(99999);
const texto = z.string().trim().max(300);
const opcional = texto.transform((s) => s || null).nullish();
const base = z.object({ filialId: z.string().min(1), dia: z.string() });

const vendaSchema = base.extend({
  categoriaId: z.string().min(1, "Escolha a categoria."),
  entregadorId: z.string().nullish(),
  produtoId: z.string().min(1, "Escolha o produto."),
  quantidade: qtd,
  valorUnit: valor("Informe o preço."),
  obs: opcional,
});

export async function addVenda(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = vendaSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    await prisma.venda.create({
      data: {
        filialId: d.filialId,
        data: paraDate(d.dia),
        categoriaId: d.categoriaId,
        entregadorId: d.entregadorId || null,
        produtoId: d.produtoId,
        quantidade: d.quantidade,
        valorUnit: d.valorUnit,
        total: arred(d.quantidade * d.valorUnit),
        obs: d.obs ?? null,
        criadoPor: ctx.user.name,
      },
    });
  });
}

const compraSchema = base.extend({
  produtoId: z.string().min(1, "Escolha o produto."),
  quantidade: qtd,
  valor: valor().optional(),
  fornecedor: opcional,
  pagamento: opcional,
  vencimento: z.string().nullish(),
  nota: opcional,
  obs: opcional,
});

export async function addCompra(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = compraSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    await prisma.compra.create({
      data: {
        filialId: d.filialId,
        data: paraDate(d.dia),
        produtoId: d.produtoId,
        quantidade: d.quantidade,
        valor: d.valor ?? 0,
        fornecedor: d.fornecedor ?? null,
        pagamento: d.pagamento ?? null,
        vencimento: isDia(d.vencimento) ? paraDate(d.vencimento) : null,
        nota: d.nota ?? null,
        obs: d.obs ?? null,
        criadoPor: ctx.user.name,
      },
    });
  });
}

const valeSchema = base.extend({
  descricao: texto.min(1, "Informe de quem é o vale."),
  valor: valor().refine((v) => v > 0, "Informe o valor."),
  obs: opcional,
});

export async function addVale(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = valeSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    await prisma.vale.create({
      data: {
        filialId: d.filialId,
        data: paraDate(d.dia),
        descricao: d.descricao,
        valor: d.valor,
        obs: d.obs ?? null,
        criadoPor: ctx.user.name,
      },
    });
  });
}

/** Marca o vale como recebido em `dia` (ou desfaz, com recebimento = null). */
export async function receberVale(id: string, dia: string, recebimento: "CAIXA" | "CONTA" | "DESCONTO" | null): Promise<Resultado> {
  return executar(async () => {
    const vale = await prisma.vale.findUnique({ where: { id } });
    if (!vale) throw new Negado("Vale não encontrado.");
    await autorizar(vale.filialId, recebimento ? dia : vale.recebidoEm ? paraDia(vale.recebidoEm) : dia);
    await prisma.vale.update({
      where: { id },
      data: recebimento ? { recebidoEm: paraDate(dia), recebimento } : { recebidoEm: null, recebimento: null },
    });
  });
}

const despesaSchema = base.extend({
  descricao: texto.min(1, "Descreva a despesa."),
  categoriaId: z.string().min(1, "Escolha a categoria."),
  subcategoria: opcional,
  valor: valor().refine((v) => v > 0, "Informe o valor."),
  origem: z.enum(["CAIXA", "CARTAO", "CONTA"]),
  placa: opcional,
  km: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/\D/g, ""))), z.number().int().nullable()),
});

export async function addDespesa(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = despesaSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    await prisma.despesa.create({
      data: {
        filialId: d.filialId,
        data: paraDate(d.dia),
        descricao: d.descricao,
        categoriaId: d.categoriaId,
        subcategoria: d.subcategoria ?? null,
        valor: d.valor,
        origem: d.origem,
        placa: d.placa?.toUpperCase() ?? null,
        km: d.km,
        criadoPor: ctx.user.name,
      },
    });
  });
}

const caixaSchema = base.extend({
  itens: z.record(z.string()),
  fechar: z.boolean(),
  obs: opcional,
});

export async function salvarCaixa(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = caixaSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    const formas = await prisma.formaRecebimento.findMany({ where: { filialId: d.filialId }, select: { id: true } });
    const itens = formas
      .map((f) => ({ formaId: f.id, valor: parseValor(d.itens[f.id] ?? "") }))
      .filter((i) => Number.isFinite(i.valor) && i.valor !== 0);
    if (itens.some((i) => i.valor < 0)) throw new Negado("Os valores do caixa não podem ser negativos.");
    const data = paraDate(d.dia);
    await prisma.$transaction(async (tx) => {
      const cx = await tx.caixaDia.upsert({
        where: { filialId_data: { filialId: d.filialId, data } },
        create: { filialId: d.filialId, data },
        update: {},
      });
      await tx.caixaItem.deleteMany({ where: { caixaId: cx.id } });
      await tx.caixaItem.createMany({ data: itens.map((i) => ({ ...i, caixaId: cx.id })) });
      await tx.caixaDia.update({
        where: { id: cx.id },
        data: { obs: d.obs ?? null, ...(d.fechar ? { fechado: true, fechadoPor: ctx.user.name } : {}) },
      });
    });
  });
}

export async function reabrirCaixa(filialId: string, dia: string): Promise<Resultado> {
  return executar(async () => {
    const ctx = await autorizar(filialId, dia);
    if (!ctx.gestor) throw new Negado("Só o gestor pode reabrir o caixa.");
    await prisma.caixaDia.updateMany({ where: { filialId, data: paraDate(dia) }, data: { fechado: false } });
  });
}

const ajusteSchema = base.extend({
  produtoId: z.string().min(1),
  quantidade: z.coerce.number().int().refine((v) => v !== 0, "Informe a quantidade."),
  motivo: opcional,
});

/** Ajuste de contagem do estoque (somente gestor). */
export async function addAjuste(input: Record<string, unknown>): Promise<Resultado> {
  return executar(async () => {
    const d = ajusteSchema.parse(input);
    const ctx = await autorizar(d.filialId, d.dia);
    if (!ctx.gestor) throw new Negado("Só o gestor pode ajustar o estoque.");
    await prisma.ajusteEstoque.create({
      data: { filialId: d.filialId, data: paraDate(d.dia), produtoId: d.produtoId, quantidade: d.quantidade, motivo: d.motivo ?? null, criadoPor: ctx.user.name },
    });
  });
}

const TABELAS = { venda: prisma.venda, compra: prisma.compra, vale: prisma.vale, despesa: prisma.despesa, ajuste: prisma.ajusteEstoque } as const;

export async function excluir(tipo: keyof typeof TABELAS, id: string): Promise<Resultado> {
  return executar(async () => {
    if (!(tipo in TABELAS)) throw new Negado("Tipo inválido.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tabela = TABELAS[tipo] as any;
    const reg = await tabela.findUnique({ where: { id }, select: { filialId: true, data: true } });
    if (!reg) return;
    await autorizar(reg.filialId, paraDia(reg.data));
    await tabela.delete({ where: { id } });
  });
}

export async function escolherFilial(id: string) {
  (await cookies()).set("filial", id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
