import { prisma } from "@/lib/prisma";
import { arred } from "@/lib/dinheiro";
import { paraDate, paraDia, somaDias } from "@/lib/datas";
import { conferir, type Situacao } from "@/lib/caixa";

export { TOLERANCIA, conferir, SITUACAO_TEXTO, projetar, type Situacao } from "@/lib/caixa";

export type ProdutoInfo = {
  id: string;
  nome: string;
  tipo: "GAS" | "VASILHAME" | "OUTRO";
  baseId: string | null;
  custo: number;
  precos: number[];
};

export async function listarProdutos(apenasAtivos = true): Promise<ProdutoInfo[]> {
  const ps = await prisma.produto.findMany({
    where: apenasAtivos ? { ativo: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return ps.map((p) => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    baseId: p.baseId,
    custo: Number(p.custo),
    precos: p.precos
      .split(/[;\s]+/)
      .map((x) => Number(x.replace(",", ".")))
      .filter((x) => x > 0),
  }));
}

export type DiaResumo = {
  dia: string;
  /** Produto principal (primeiro botijão cadastrado, normalmente P13). */
  inicial: number;
  compra: number;
  venda: number;
  final: number;
  valorMedio: number;
  vendaTotal: number;
  valesRecebidos: number;
  /** Itens informados no caixa por forma de recebimento. */
  formas: Record<string, number>;
  valesEmitidos: number;
  despesasCaixa: number;
  caixa: number;
  esperado: number;
  diferenca: number;
  situacao: Situacao;
  temMovimento: boolean;
  fechado: boolean;
  bruto: number;
  despesas: number;
  liquido: number;
  /** Cheios ao fim do dia, por produto de gás. */
  cheios: Record<string, number>;
  /** Total de vasilhames (cheios + vazios) ao fim do dia, por produto de gás. */
  cascos: Record<string, number>;
  /** Quantidade vendida no dia por produto. */
  vendidos: Record<string, number>;
  comprados: Record<string, number>;
};

type Mov = Map<string, Map<string, number>>; // dia -> produtoId -> qtd

function add(m: Mov, dia: string, k: string, v: number) {
  let d = m.get(dia);
  if (!d) m.set(dia, (d = new Map()));
  d.set(k, (d.get(k) ?? 0) + v);
}

/** Resumo diário (o equivalente à aba "Resumo") de `de` até `ate`, somando as filiais informadas. */
export async function resumoDias(filialIds: string[], de: string, ate: string): Promise<DiaResumo[]> {
  const filial = { in: filialIds };
  const periodo = { gte: paraDate(de), lte: paraDate(ate) };
  const antes = { lt: paraDate(de) };
  const [produtos, categorias, vAntes, cAntes, aAntes, vendas, compras, ajustes, valesRec, valesEmi, despesas, caixas] =
    await Promise.all([
      listarProdutos(false),
      prisma.categoriaVenda.findMany({ select: { id: true, contaReceita: true } }),
      prisma.venda.groupBy({ by: ["produtoId"], where: { filialId: filial, data: antes }, _sum: { quantidade: true } }),
      prisma.compra.groupBy({ by: ["produtoId"], where: { filialId: filial, data: antes }, _sum: { quantidade: true } }),
      prisma.ajusteEstoque.groupBy({ by: ["produtoId"], where: { filialId: filial, data: antes }, _sum: { quantidade: true } }),
      prisma.venda.groupBy({
        by: ["data", "produtoId", "categoriaId"],
        where: { filialId: filial, data: periodo },
        _sum: { quantidade: true, total: true },
      }),
      prisma.compra.groupBy({ by: ["data", "produtoId"], where: { filialId: filial, data: periodo }, _sum: { quantidade: true } }),
      prisma.ajusteEstoque.groupBy({ by: ["data", "produtoId"], where: { filialId: filial, data: periodo }, _sum: { quantidade: true } }),
      prisma.vale.groupBy({
        by: ["recebidoEm"],
        where: { filialId: filial, recebidoEm: periodo, recebimento: "CAIXA" },
        _sum: { valor: true },
      }),
      prisma.vale.groupBy({ by: ["data"], where: { filialId: filial, data: periodo }, _sum: { valor: true } }),
      prisma.despesa.groupBy({ by: ["data", "origem"], where: { filialId: filial, data: periodo }, _sum: { valor: true } }),
      prisma.caixaDia.findMany({ where: { filialId: filial, data: periodo }, include: { itens: true } }),
    ]);

  const gas = produtos.filter((p) => p.tipo === "GAS");
  const principal = gas[0]?.id;
  const cascoDe = new Map(produtos.filter((p) => p.tipo === "VASILHAME" && p.baseId).map((p) => [p.id, p.baseId!]));
  const custo = new Map(produtos.map((p) => [p.id, p.custo]));
  const receita = new Map(categorias.map((c) => [c.id, c.contaReceita]));

  // saldo acumulado antes do período
  const saldo = new Map<string, number>();
  const soma = (id: string, v: number) => saldo.set(id, (saldo.get(id) ?? 0) + v);
  cAntes.forEach((r) => soma(r.produtoId, r._sum.quantidade ?? 0));
  aAntes.forEach((r) => soma(r.produtoId, r._sum.quantidade ?? 0));
  vAntes.forEach((r) => soma(r.produtoId, -(r._sum.quantidade ?? 0)));

  const mVenda: Mov = new Map();
  const mCompra: Mov = new Map();
  const mAjuste: Mov = new Map();
  const tot = new Map<string, { total: number; qP: number; tP: number; bruto: number }>();
  for (const r of vendas) {
    const dia = paraDia(r.data);
    const q = r._sum.quantidade ?? 0;
    const t = Number(r._sum.total ?? 0);
    add(mVenda, dia, r.produtoId, q);
    let x = tot.get(dia);
    if (!x) tot.set(dia, (x = { total: 0, qP: 0, tP: 0, bruto: 0 }));
    x.total += t;
    if (receita.get(r.categoriaId)) {
      x.bruto += t - q * (custo.get(r.produtoId) ?? 0);
      if (r.produtoId === principal) {
        x.qP += q;
        x.tP += t;
      }
    }
  }
  compras.forEach((r) => add(mCompra, paraDia(r.data), r.produtoId, r._sum.quantidade ?? 0));
  ajustes.forEach((r) => add(mAjuste, paraDia(r.data), r.produtoId, r._sum.quantidade ?? 0));
  const mValesRec = new Map(valesRec.map((r) => [paraDia(r.recebidoEm!), Number(r._sum.valor ?? 0)]));
  const mValesEmi = new Map(valesEmi.map((r) => [paraDia(r.data), Number(r._sum.valor ?? 0)]));
  const mDesp = new Map<string, { todas: number; caixa: number }>();
  for (const r of despesas) {
    const dia = paraDia(r.data);
    const x = mDesp.get(dia) ?? { todas: 0, caixa: 0 };
    const v = Number(r._sum.valor ?? 0);
    x.todas += v;
    if (r.origem === "CAIXA") x.caixa += v;
    mDesp.set(dia, x);
  }
  const mCaixa = new Map<string, { formas: Record<string, number>; fechado: boolean }>();
  for (const c of caixas) {
    const dia = paraDia(c.data);
    const x = mCaixa.get(dia) ?? { formas: {}, fechado: true };
    for (const i of c.itens) x.formas[i.formaId] = (x.formas[i.formaId] ?? 0) + Number(i.valor);
    x.fechado = x.fechado && c.fechado;
    mCaixa.set(dia, x);
  }

  const out: DiaResumo[] = [];
  for (let dia = de; dia <= ate; dia = somaDias(dia, 1)) {
    const v = mVenda.get(dia);
    const c = mCompra.get(dia);
    const a = mAjuste.get(dia);
    const inicial = principal ? (saldo.get(principal) ?? 0) : 0;
    for (const m of [c, a]) m?.forEach((q, id) => soma(id, q));
    v?.forEach((q, id) => soma(id, -q));
    const cheios: Record<string, number> = {};
    const cascos: Record<string, number> = {};
    for (const g of gas) cheios[g.id] = saldo.get(g.id) ?? 0;
    cascoDe.forEach((base, id) => (cascos[base] = (cascos[base] ?? 0) + (saldo.get(id) ?? 0)));
    const t = tot.get(dia);
    const cx = mCaixa.get(dia);
    const formas = cx?.formas ?? {};
    const valesEmitidos = mValesEmi.get(dia) ?? 0;
    const desp = mDesp.get(dia) ?? { todas: 0, caixa: 0 };
    const vendaTotal = arred(t?.total ?? 0);
    const valesRecebidos = mValesRec.get(dia) ?? 0;
    const informado = Object.values(formas).reduce((s, x) => s + x, 0);
    const caixa = arred(informado + valesEmitidos + desp.caixa);
    const esperado = arred(vendaTotal + valesRecebidos);
    const bruto = arred(t?.bruto ?? 0);
    out.push({
      dia,
      inicial,
      compra: (principal && c?.get(principal)) || 0,
      venda: (principal && v?.get(principal)) || 0,
      final: principal ? (saldo.get(principal) ?? 0) : 0,
      valorMedio: t && t.qP ? arred(t.tP / t.qP) : 0,
      vendaTotal,
      valesRecebidos,
      formas,
      valesEmitidos,
      despesasCaixa: desp.caixa,
      caixa,
      esperado,
      diferenca: arred(esperado - caixa),
      situacao: conferir(esperado, caixa),
      temMovimento: !!(v || c || cx || valesEmitidos || desp.todas || valesRecebidos),
      fechado: !!cx?.fechado,
      bruto,
      despesas: arred(desp.todas),
      liquido: arred(bruto - desp.todas),
      cheios,
      cascos,
      vendidos: Object.fromEntries(v ?? []),
      comprados: Object.fromEntries(c ?? []),
    });
  }
  return out;
}
