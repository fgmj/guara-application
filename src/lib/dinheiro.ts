const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function brl(v: number): string {
  return BRL.format(Math.abs(v) < 0.005 ? 0 : v);
}

export function num(v: number): string {
  return NUM.format(v);
}

/** Aceita "1.234,56", "1234.56", "R$ 130" etc. Retorna NaN se inválido. */
export function parseValor(s: unknown): number {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return NaN;
  let t = s.replace(/[R$\s]/g, "");
  if (t === "") return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function arred(v: number): number {
  return Math.round(v * 100) / 100;
}
