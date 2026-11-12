import type { Workbook, Worksheet, CellValue } from "exceljs";
import { paraDia } from "@/lib/datas";

/** Chave para comparar nomes sem acento, caixa ou espaços sobrando. */
export function chave(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** Nome de produto como no sistema ("P13 - VAZILHAME" -> "P13 - VASILHAME"). */
export function nomeProduto(s: string): string {
  return s.replace(/\s+/g, " ").trim().replace(/VAZILHAME/i, "VASILHAME");
}

const ehFormula = (v: CellValue) => typeof v === "object" && v !== null && ("formula" in v || "sharedFormula" in v);

function bruto(v: CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    return null;
  }
  return v;
}

function dia(v: CellValue): string | null {
  const x = bruto(v);
  if (x instanceof Date && !Number.isNaN(x.getTime())) return paraDia(x);
  if (typeof x === "number" && x > 30000 && x < 80000) return paraDia(new Date(Math.round((x - 25569) * 86400000)));
  if (typeof x === "string") {
    const m = x.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function numero(v: CellValue): number {
  const x = bruto(v);
  if (typeof x === "number") return Math.round(x * 100) / 100;
  if (typeof x === "string") {
    const n = Number(x.replace(/[R$\s.]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const texto = (v: CellValue) => { const x = bruto(v); return x == null || x instanceof Date ? "" : String(x).replace(/\s+/g, " ").trim(); };

/** Lê uma aba como linhas indexadas pelo cabeçalho normalizado (primeira ocorrência de cada nome). */
function linhas(ws: Worksheet | undefined): { col: Map<string, number>; rows: CellValue[][] } {
  const col = new Map<string, number>();
  const rows: CellValue[][] = [];
  if (!ws) return { col, rows };
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const vals = row.values as CellValue[];
    if (n === 1) vals.forEach((v, i) => { const k = chave(texto(v)); if (k && !col.has(k)) col.set(k, i); });
    else rows.push(vals);
  });
  return { col, rows };
}

const aba = (wb: Workbook, nome: string) => wb.worksheets.find((w) => chave(w.name) === chave(nome));

export type Importado = {
  vendas: { dia: string; categoria: string; entregador: string; produto: string; quantidade: number; valorUnit: number; total: number }[];
  compras: { dia: string; produto: string; quantidade: number; valor: number; pagamento: string; fornecedor: string; nota: string; obs: string; vencimento: string | null; pago: boolean }[];
  vales: { dia: string; descricao: string; valor: number; recebidoEm: string | null; recebimento: "CAIXA" | "CONTA" | "DESCONTO" | null; obs: string }[];
  despesas: { dia: string; descricao: string; categoria: string; subcategoria: string; valor: number; origem: "CAIXA" | "CARTAO" | "CONTA"; placa: string; km: number | null }[];
  caixa: { dia: string; forma: string; valor: number }[];
  /** Posição da aba "Estoque Final Diário": dia -> produto -> quantidade. */
  estoque: Map<string, Record<string, number>>;
};

/** Extrai os lançamentos das abas de digitação da planilha de controle (as abas de resumo são recalculadas pelo sistema). */
export function lerPlanilha(wb: Workbook): Importado {
  const out: Importado = { vendas: [], compras: [], vales: [], despesas: [], caixa: [], estoque: new Map() };

  {
    const { col, rows } = linhas(aba(wb, "Vendas"));
    const c = (k: string) => col.get(k) ?? -1;
    for (const r of rows) {
      const d = dia(r[c("DATA")]);
      const quantidade = Math.trunc(numero(r[c("QUANTIDADE")]));
      const produto = texto(r[c("PRODUTO")]);
      if (!d || !produto || quantidade <= 0) continue;
      const valorUnit = numero(r[c("VALOR UN")]);
      out.vendas.push({ dia: d, categoria: texto(r[c("DETALHE")]) || texto(r[c("CATEGORIA")]), entregador: texto(r[c("ENTREGADOR")]), produto: nomeProduto(produto), quantidade, valorUnit, total: numero(r[c("VALOR")]) || Math.round(quantidade * valorUnit * 100) / 100 });
    }
  }
  {
    const { col, rows } = linhas(aba(wb, "Compras"));
    const c = (k: string) => col.get(k) ?? -1;
    for (const r of rows) {
      const d = dia(r[c("DATA")]);
      const quantidade = Math.trunc(numero(r[c("QUANTIDADE")]));
      const produto = texto(r[c("PRODUTO")]);
      if (!d || !produto || quantidade <= 0) continue;
      out.compras.push({
        dia: d, produto: nomeProduto(produto), quantidade, valor: numero(r[c("VALOR")]), pagamento: texto(r[c("BOLETO / TAG")]), fornecedor: texto(r[c("EMPRESA NFE")]),
        nota: texto(r[c("NUMERO NOTA")]), obs: texto(r[c("OBSERVACAO")]), vencimento: dia(r[c("DATA VENCIMENTO")]), pago: !!(texto(r[c("PAGO")]) || texto(r[c("PAGAMENTO")])),
      });
    }
  }
  {
    const { col, rows } = linhas(aba(wb, "Vales"));
    const c = (k: string) => col.get(k) ?? -1;
    for (const r of rows) {
      const d = dia(r[c("DATA")]);
      const valor = numero(r[c("VALOR")]);
      const descricao = texto(r[c("DESCRICAO")]);
      if (!d || !descricao || valor <= 0) continue;
      const recebidoEm = dia(r[c("DATA RECEBIMENTO")]);
      const tipo = chave(texto(r[c("TIPO RECEBIMENTO")]));
      out.vales.push({ dia: d, descricao, valor, recebidoEm, recebimento: !recebidoEm ? null : tipo.includes("DESCONT") ? "DESCONTO" : tipo.includes("CONTA") ? "CONTA" : "CAIXA", obs: texto(r[c("OBSERVACAO 1")]) || texto(r[c("OBSERVACAO")]) });
    }
  }
  {
    const { col, rows } = linhas(aba(wb, "Despesas"));
    const c = (k: string) => col.get(k) ?? -1;
    for (const r of rows) {
      const d = dia(r[c("DATA")]);
      const valor = numero(r[c("VALOR")]);
      if (!d || valor <= 0) continue;
      const origem = chave(texto(r[c("ORIGEM")]));
      const km = Math.trunc(numero(r[c("KM")]));
      out.despesas.push({
        dia: d, descricao: texto(r[c("DESCRICAO")]) || "Despesa", categoria: texto(r[c("CATEGORIA")]), subcategoria: texto(r[c("SUBCATEGORIA")]), valor,
        origem: origem.startsWith("CAIXA") ? "CAIXA" : origem.startsWith("CART") ? "CARTAO" : "CONTA", placa: texto(r[c("PLACA")]).toUpperCase(), km: km > 0 ? km : null,
      });
    }
  }
  {
    // Caixa: só as colunas digitadas (as calculadas por fórmula e as que vêm de outras abas ficam de fora).
    const { col, rows } = linhas(aba(wb, "Caixa"));
    const cData = col.get("DATA") ?? -1;
    const formas = [...col.entries()].filter(([k, i]) => i > cData && !/^(DATA|TOTAL|VALES A RECEBER|DESPESAS.*)$/.test(k) && !/^\d/.test(k));
    const ws = aba(wb, "Caixa");
    const nomes = new Map<number, string>();
    ws?.getRow(1).eachCell((cell, i) => nomes.set(i, texto(cell.value)));
    for (const r of rows) {
      const d = dia(r[cData]);
      if (!d) continue;
      for (const [, i] of formas) {
        if (ehFormula(r[i])) continue;
        const valor = numero(r[i]);
        if (valor > 0) out.caixa.push({ dia: d, forma: nomes.get(i) ?? "", valor });
      }
    }
  }
  {
    const ws = aba(wb, "Estoque Final Diário");
    const { col, rows } = linhas(ws);
    const cData = col.get("DATA") ?? -1;
    const nomes = new Map<number, string>();
    ws?.getRow(1).eachCell((cell, i) => nomes.set(i, nomeProduto(texto(cell.value))));
    for (const r of rows) {
      const d = dia(r[cData]);
      if (!d) continue;
      const pos: Record<string, number> = {};
      nomes.forEach((nome, i) => { if (i > cData && /^P\d+/.test(nome) && bruto(r[i]) != null && bruto(r[i]) !== "") pos[nome] = Math.trunc(numero(r[i])); });
      out.estoque.set(d, pos);
    }
  }
  return out;
}
