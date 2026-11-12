import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fimMes, hoje, inicioMes, paraDate, somaMeses } from "@/lib/datas";
import { resumoDias } from "@/lib/resumo";

export type Celulas = Record<string, number>; // mês -> valor
export type LinhaMatriz = { rotulo: string; sub?: boolean; forte?: boolean; valores: Celulas };

export function ultimosMeses(ate: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somaMeses(ate, i - n + 1));
}

function matriz(rows: { mes: string; k: string; v: number | bigint | Prisma.Decimal | null }[]): Map<string, Celulas> {
  const m = new Map<string, Celulas>();
  for (const r of rows) {
    const c = m.get(r.k) ?? {};
    c[r.mes] = (c[r.mes] ?? 0) + Number(r.v ?? 0);
    m.set(r.k, c);
  }
  return m;
}

const linhas = (m: Map<string, Celulas>): LinhaMatriz[] =>
  [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([rotulo, valores]) => ({ rotulo, valores }));

export function somar(ls: LinhaMatriz[], rotulo: string): LinhaMatriz {
  const valores: Celulas = {};
  for (const l of ls) if (!l.sub) for (const [k, v] of Object.entries(l.valores)) valores[k] = (valores[k] ?? 0) + v;
  return { rotulo, valores, forte: true };
}

type Row = { mes: string; k: string; v: number };

export async function relatorioMensal(filialIds: string[], meses: string[]) {
  const ids = Prisma.join(filialIds.length ? filialIds : [""]);
  const de = paraDate(inicioMes(meses[0]));
  const ate = paraDate(fimMes(meses[meses.length - 1]));
  const mes = Prisma.sql`to_char(x."data", 'YYYY-MM')`;
  const onde = Prisma.sql`x."filialId" IN (${ids}) AND x."data" BETWEEN ${de} AND ${ate}`;

  const [catQtd, catTotal, entQtd, prodQtd, despCat, despSub, formas, valesEmi, valesRec, despCaixa, cmv] = await Promise.all([
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, c."nome" k, SUM(x."quantidade")::float v FROM vendas x JOIN categorias_venda c ON c.id = x."categoriaId" JOIN produtos p ON p.id = x."produtoId" WHERE ${onde} AND p."tipo" = 'GAS' GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, c."nome" k, SUM(x."total")::float v FROM vendas x JOIN categorias_venda c ON c.id = x."categoriaId" WHERE ${onde} GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, COALESCE(e."nome", 'Sem entregador') k, SUM(x."quantidade")::float v FROM vendas x LEFT JOIN entregadores e ON e.id = x."entregadorId" JOIN produtos p ON p.id = x."produtoId" WHERE ${onde} AND p."tipo" = 'GAS' GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, p."nome" k, SUM(x."quantidade")::float v FROM vendas x JOIN produtos p ON p.id = x."produtoId" WHERE ${onde} GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, c."nome" k, SUM(x."valor")::float v FROM despesas x JOIN categorias_despesa c ON c.id = x."categoriaId" WHERE ${onde} GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, c."nome" || '|' || x."subcategoria" k, SUM(x."valor")::float v FROM despesas x JOIN categorias_despesa c ON c.id = x."categoriaId" WHERE ${onde} AND x."subcategoria" IS NOT NULL GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, f."nome" k, SUM(i."valor")::float v FROM caixa_itens i JOIN caixas x ON x.id = i."caixaId" JOIN formas_recebimento f ON f.id = i."formaId" WHERE ${onde} GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, 'v' k, SUM(x."valor")::float v FROM vales x WHERE ${onde} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT to_char(x."recebidoEm", 'YYYY-MM') mes, 'v' k, SUM(x."valor")::float v FROM vales x WHERE x."filialId" IN (${ids}) AND x."recebidoEm" BETWEEN ${de} AND ${ate} AND x."recebimento" = 'CAIXA' GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, 'v' k, SUM(x."valor")::float v FROM despesas x WHERE ${onde} AND x."origem" = 'CAIXA' GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT ${mes} mes, 'v' k, SUM(x."quantidade" * p."custo")::float v FROM vendas x JOIN produtos p ON p.id = x."produtoId" JOIN categorias_venda c ON c.id = x."categoriaId" WHERE ${onde} AND c."contaReceita" GROUP BY 1`,
  ]);

  // despesas: categoria com as subcategorias logo abaixo
  const subs = matriz(despSub);
  const despesas: LinhaMatriz[] = [];
  for (const l of linhas(matriz(despCat))) {
    despesas.push(l);
    for (const [k, valores] of [...subs.entries()].sort()) {
      const [cat, sub] = k.split("|");
      if (cat === l.rotulo) despesas.push({ rotulo: sub, sub: true, valores });
    }
  }
  const um = (rows: Row[]) => matriz(rows).get("v") ?? {};

  const caixa = linhas(matriz(formas));
  const extras: LinhaMatriz[] = [
    { rotulo: "Vales a receber (lançados)", valores: um(valesEmi) },
    { rotulo: "Despesas pagas com o caixa", valores: um(despCaixa) },
  ];
  const recebidos = Object.fromEntries(Object.entries(um(valesRec)).map(([k, v]) => [k, -v]));
  const totalCaixa = somar([...caixa, ...extras], "Total do caixa");
  const receitaCaixa = somar([totalCaixa, { rotulo: "", valores: recebidos }], "Receita do mês (caixa − vales recebidos)");

  const receita = somar(linhas(matriz(catTotal)), "Receita bruta");
  const custo = um(cmv);
  const totalDesp = somar(despesas, "Total de despesas");
  const neg = (c: Celulas) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, -v]));
  const margem = somar([receita, { rotulo: "", valores: neg(custo) }], "Margem bruta");
  const resultado = somar([margem, { rotulo: "", valores: neg(totalDesp.valores) }], "Resultado líquido");

  return {
    vendasQtd: linhas(matriz(catQtd)),
    vendasTotal: linhas(matriz(catTotal)),
    entregadores: linhas(matriz(entQtd)),
    produtos: linhas(matriz(prodQtd)),
    despesas,
    totalDesp,
    caixa: [...caixa, ...extras, totalCaixa, { rotulo: "(−) Vales recebidos no caixa", valores: recebidos }, receitaCaixa],
    dre: [
      receita,
      { rotulo: "(−) Custo dos produtos vendidos", valores: neg(custo) },
      margem,
      ...despesas.filter((l) => !l.sub).map((l) => ({ rotulo: `(−) ${l.rotulo}`, sub: true, valores: neg(l.valores) })),
      { rotulo: "(−) Despesas", valores: neg(totalDesp.valores) },
      resultado,
    ] as LinhaMatriz[],
  };
}

export type MesHistorico = { mes: string; qtd: number; vendas: number; bruto: number; despesas: number; liquido: number; dias: number };

/** Histórico mensal (até hoje) a partir do resumo diário. */
export async function historico(filialIds: string[], meses: string[]): Promise<MesHistorico[]> {
  const hj = hoje();
  const fim = fimMes(meses[meses.length - 1]);
  const dias = await resumoDias(filialIds, inicioMes(meses[0]), fim < hj ? fim : hj);
  return meses.map((mes) => {
    const ds = dias.filter((d) => d.dia.startsWith(mes));
    const s = (f: (d: (typeof ds)[number]) => number) => Math.round(ds.reduce((a, d) => a + f(d), 0) * 100) / 100;
    return { mes, qtd: s((d) => d.venda), vendas: s((d) => d.vendaTotal), bruto: s((d) => d.bruto), despesas: s((d) => d.despesas), liquido: s((d) => d.liquido), dias: ds.length };
  });
}
