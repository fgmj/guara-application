/** Datas de negócio são dias no fuso de Brasília, representados como "AAAA-MM-DD". */
const TZ = "America/Sao_Paulo";

export function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function isDia(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** "AAAA-MM-DD" -> Date (meia-noite UTC), formato usado nas colunas @db.Date. */
export function paraDate(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

export function paraDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somaDias(dia: string, n: number): string {
  const d = paraDate(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return paraDia(d);
}

export function diffDias(a: string, b: string): number {
  return Math.round((paraDate(a).getTime() - paraDate(b).getTime()) / 86400000);
}

export function inicioMes(mes: string): string {
  return `${mes.slice(0, 7)}-01`;
}

export function fimMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return paraDia(new Date(Date.UTC(a, m, 0)));
}

export function somaMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  return paraDia(new Date(Date.UTC(a, m - 1 + n, 1))).slice(0, 7);
}

export function isMes(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function rotuloMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
}

export function fmtDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

export function fmtDiaCurto(dia: string): string {
  const sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][paraDate(dia).getUTCDay()];
  return `${sem} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}
