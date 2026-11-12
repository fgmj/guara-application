"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getContexto } from "@/lib/contexto";
import { paraDate, somaDias } from "@/lib/datas";
import { chave, lerPlanilha } from "@/lib/importar";
import { resumoDias } from "@/lib/resumo";

export type Estado = { erro?: string; ok?: string[] };

async function emLotes<T>(itens: T[], gravar: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += 1000) await gravar(itens.slice(i, i + 1000));
}

/** Importa o histórico de uma planilha de controle (.xlsx) para a filial, substituindo os lançamentos dela. */
export async function importarPlanilha(_: Estado, fd: FormData): Promise<Estado> {
  const ctx = await getContexto();
  if (!ctx.gestor) return { erro: "Somente o gestor pode importar." };
  const filialId = String(fd.get("filialId") ?? "");
  const arquivo = fd.get("arquivo");
  if (!ctx.filiais.some((f) => f.id === filialId)) return { erro: "Escolha a filial." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo .xlsx da planilha." };
  if (fd.get("confirmo") !== "on") return { erro: "Marque a confirmação: a importação substitui os lançamentos da filial." };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await arquivo.arrayBuffer());
  } catch {
    return { erro: "Não consegui ler o arquivo. Baixe a planilha em Arquivo → Fazer download → Microsoft Excel (.xlsx)." };
  }
  const p = lerPlanilha(wb);
  if (p.vendas.length + p.compras.length + p.despesas.length + p.vales.length === 0) {
    return { erro: "Não encontrei lançamentos. O arquivo precisa ter as abas Vendas, Compras, Vales, Despesas e Caixa." };
  }

  // cadastros: reaproveita os existentes (comparando sem acento) e cria os que faltam
  async function mapa<T extends { id: string; nome: string }>(existentes: T[], nomes: string[], criar: (nome: string) => Promise<T>) {
    const m = new Map(existentes.map((x) => [chave(x.nome), x.id]));
    for (const nome of new Set(nomes)) if (nome && !m.has(chave(nome))) m.set(chave(nome), (await criar(nome)).id);
    return (nome: string) => m.get(chave(nome));
  }
  const produtosAtuais = await prisma.produto.findMany();
  const produto = await mapa(produtosAtuais, [...p.vendas.map((v) => v.produto), ...p.compras.map((c) => c.produto)], async (nome) => {
    const base = /VASILHAME/i.test(nome) ? (await prisma.produto.findMany()).find((x) => chave(x.nome) === chave(nome.replace(/\s*-\s*VASILHAME/i, ""))) : undefined;
    return prisma.produto.create({ data: { nome, tipo: base ? "VASILHAME" : /^P\d+$/i.test(nome) ? "GAS" : "OUTRO", baseId: base?.id, ordem: 50 } });
  });
  const categoria = await mapa(await prisma.categoriaVenda.findMany(), [...p.vendas.map((v) => v.categoria || "SEM CATEGORIA")], (nome) =>
    prisma.categoriaVenda.create({ data: { nome: nome.toUpperCase(), contaReceita: !/TROCA|TRANSFER|EMPREST/.test(chave(nome)), ordem: 50 } }));
  // entregadores novos só ficam ativos (aparecem na tela de venda) se venderam nos últimos 90 dias do histórico
  const ultimoDia = p.vendas.reduce((m, v) => (v.dia > m ? v.dia : m), "");
  const recentes = new Set(p.vendas.filter((v) => ultimoDia && v.dia >= somaDias(ultimoDia, -90)).map((v) => chave(v.entregador)));
  const entregador = await mapa(await prisma.entregador.findMany({ where: { filialId } }), p.vendas.map((v) => v.entregador), (nome) => prisma.entregador.create({ data: { nome, filialId, ativo: recentes.has(chave(nome)) } }));
  const catDespesa = await mapa(await prisma.categoriaDespesa.findMany(), p.despesas.map((d) => d.categoria || "Diversos"), (nome) => prisma.categoriaDespesa.create({ data: { nome } }));
  const forma = await mapa(await prisma.formaRecebimento.findMany({ where: { filialId } }), p.caixa.map((c) => c.forma), (nome) =>
    prisma.formaRecebimento.create({ data: { nome, filialId, ordem: 50, grupo: /PIX/i.test(nome) ? "PIX" : /DINHEIRO/i.test(nome) ? "DINHEIRO" : /CART/i.test(nome) ? "CARTAO" : "OUTRO" } }));

  const criadoPor = "Importação";
  const f = { filialId };
  await prisma.$transaction([
    prisma.venda.deleteMany({ where: f }), prisma.compra.deleteMany({ where: f }), prisma.vale.deleteMany({ where: f }),
    prisma.despesa.deleteMany({ where: f }), prisma.caixaDia.deleteMany({ where: f }), prisma.ajusteEstoque.deleteMany({ where: f }),
  ]);
  await emLotes(p.vendas, (l) => prisma.venda.createMany({ data: l.map((v) => ({ filialId, data: paraDate(v.dia), categoriaId: categoria(v.categoria || "SEM CATEGORIA")!, entregadorId: entregador(v.entregador) ?? null, produtoId: produto(v.produto)!, quantidade: v.quantidade, valorUnit: v.valorUnit, total: v.total, criadoPor })) }));
  await emLotes(p.compras, (l) => prisma.compra.createMany({ data: l.map((c) => ({ filialId, data: paraDate(c.dia), produtoId: produto(c.produto)!, quantidade: c.quantidade, valor: c.valor, fornecedor: c.fornecedor || null, pagamento: c.pagamento || null, nota: c.nota || null, obs: c.obs || null, vencimento: c.vencimento ? paraDate(c.vencimento) : null, pagoEm: c.pago ? paraDate(c.vencimento ?? c.dia) : null, criadoPor })) }));
  await emLotes(p.vales, (l) => prisma.vale.createMany({ data: l.map((v) => ({ filialId, data: paraDate(v.dia), descricao: v.descricao, valor: v.valor, recebidoEm: v.recebidoEm ? paraDate(v.recebidoEm) : null, recebimento: v.recebimento, obs: v.obs || null, criadoPor })) }));
  await emLotes(p.despesas, (l) => prisma.despesa.createMany({ data: l.map((d) => ({ filialId, data: paraDate(d.dia), descricao: d.descricao, categoriaId: catDespesa(d.categoria || "Diversos")!, subcategoria: d.subcategoria || null, valor: d.valor, origem: d.origem, placa: d.placa || null, km: d.km, criadoPor })) }));

  // caixa: um registro por dia (já fechado), somando valores repetidos da mesma forma
  const dias = new Map<string, Map<string, number>>();
  for (const c of p.caixa) {
    const id = forma(c.forma);
    if (!id) continue;
    const m = dias.get(c.dia) ?? new Map<string, number>();
    m.set(id, (m.get(id) ?? 0) + c.valor);
    dias.set(c.dia, m);
  }
  await emLotes([...dias.keys()], (l) => prisma.caixaDia.createMany({ data: l.map((d) => ({ filialId, data: paraDate(d), fechado: true, fechadoPor: criadoPor })) }));
  const caixas = new Map((await prisma.caixaDia.findMany({ where: f, select: { id: true, data: true } })).map((c) => [c.data.toISOString().slice(0, 10), c.id]));
  await emLotes([...dias.entries()].flatMap(([d, m]) => [...m.entries()].map(([formaId, valor]) => ({ caixaId: caixas.get(d)!, formaId, valor }))), (l) => prisma.caixaItem.createMany({ data: l }));

  // estoque: ancora no último dia com movimento que tenha posição na planilha
  const datas = [...p.vendas, ...p.compras].map((x) => x.dia).sort();
  const avisos: string[] = [];
  const ancora = [...p.estoque.keys()].filter((d) => d <= (datas[datas.length - 1] ?? "")).sort().pop();
  if (ancora && datas.length) {
    const [r] = await resumoDias([filialId], ancora, ancora);
    const todos = await prisma.produto.findMany();
    const ajustes: { produtoId: string; quantidade: number }[] = [];
    for (const [nome, qtd] of Object.entries(p.estoque.get(ancora)!)) {
      const prod = todos.find((x) => chave(x.nome) === chave(nome));
      if (!prod) continue;
      const atual = prod.tipo === "GAS" ? (r.cheios[prod.id] ?? 0) : prod.tipo === "VASILHAME" && prod.baseId ? (r.cascos[prod.baseId] ?? 0) : null;
      if (atual !== null && qtd - atual !== 0) ajustes.push({ produtoId: prod.id, quantidade: qtd - atual });
    }
    await prisma.ajusteEstoque.createMany({ data: ajustes.map((a) => ({ ...a, filialId, data: paraDate(somaDias(datas[0], -1)), motivo: "Estoque inicial (importação)", criadoPor })) });
  } else {
    avisos.push("Não encontrei a aba “Estoque Final Diário”: faça uma contagem em Estoque para acertar o saldo.");
  }

  revalidatePath("/", "layout");
  return {
    ok: [
      `${p.vendas.length} vendas, ${p.compras.length} compras, ${p.vales.length} vales, ${p.despesas.length} despesas e ${dias.size} dias de caixa importados.`,
      datas.length ? `Período: ${datas[0].split("-").reverse().join("/")} a ${datas[datas.length - 1].split("-").reverse().join("/")}.` : "",
      ...avisos,
    ].filter(Boolean),
  };
}
