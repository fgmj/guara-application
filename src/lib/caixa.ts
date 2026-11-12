import { arred } from "@/lib/dinheiro";

/** Diferença tolerada entre vendas e caixa (igual à planilha). */
export const TOLERANCIA = 20;

export type Situacao = "ok" | "falta" | "sobra";

export function conferir(esperado: number, caixa: number): Situacao {
  if (caixa > esperado + TOLERANCIA) return "sobra";
  if (esperado > caixa + TOLERANCIA) return "falta";
  return "ok";
}

export const SITUACAO_TEXTO: Record<Situacao, string> = {
  ok: "Caixa conferido",
  falta: "Caixa não está batendo: falta dinheiro para as vendas lançadas.",
  sobra: "Caixa maior que as vendas: provável venda não lançada.",
};

/** Projeção linear do mês: realizado ÷ dias corridos × dias do mês. */
export function projetar(realizado: number, diasCorridos: number, diasNoMes: number): number {
  if (diasCorridos <= 0) return 0;
  return arred((realizado / diasCorridos) * diasNoMes);
}
