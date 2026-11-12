import Link from "next/link";
import { rotuloMes, somaMeses } from "@/lib/datas";
import { brl, num } from "@/lib/dinheiro";
import type { LinhaMatriz } from "@/lib/relatorios";

export function Titulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-bold">{children}</h1>
      <div className="flex flex-wrap items-center gap-2">{extra}</div>
    </header>
  );
}

export function MesNav({ base, mes, atual }: { base: string; mes: string; atual: string }) {
  const cls = "flex size-9 items-center justify-center rounded-lg border border-stone-300 bg-white";
  return (
    <nav aria-label="Mês" className="flex items-center gap-1">
      <Link href={`${base}?m=${somaMeses(mes, -1)}`} aria-label="Mês anterior" className={cls}>‹</Link>
      <span className="flex h-9 min-w-20 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold">{rotuloMes(mes)}</span>
      {mes < atual ? <Link href={`${base}?m=${somaMeses(mes, 1)}`} aria-label="Próximo mês" className={cls}>›</Link> : <span className={`${cls} opacity-30`}>›</span>}
    </nav>
  );
}

export function Bloco({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-3 md:p-4">
      <h2 className="text-sm font-semibold text-stone-700">{titulo}</h2>
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota?: string; tom?: "bom" | "ruim" }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{rotulo}</p>
      <p className={`text-xl font-bold tabular-nums ${tom === "ruim" ? "text-red-700" : tom === "bom" ? "text-emerald-700" : ""}`}>{valor}</p>
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
    </div>
  );
}

/** Tabela linhas × meses (o equivalente às tabelas dinâmicas da planilha). */
export function Matriz({ meses, linhas, dinheiro = true, vazio = "Sem lançamentos no período." }: { meses: string[]; linhas: LinhaMatriz[]; dinheiro?: boolean; vazio?: string }) {
  if (linhas.length === 0) return <p className="text-sm text-stone-500">{vazio}</p>;
  const f = (v: number | undefined) => (v ? (dinheiro ? brl(v) : num(v)) : "");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-stone-500">
            <th className="sticky left-0 bg-white text-left font-medium"></th>
            {meses.map((m) => <th key={m} className="px-2 text-right font-medium whitespace-nowrap">{rotuloMes(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={`border-t border-stone-100 ${l.forte ? "bg-stone-50 font-semibold" : ""} ${l.sub ? "text-stone-500" : ""}`}>
              <th scope="row" className={`sticky left-0 py-1 pr-3 text-left whitespace-nowrap ${l.forte ? "bg-stone-50 font-semibold" : "bg-white font-normal"} ${l.sub ? "pl-4" : ""}`}>{l.rotulo}</th>
              {meses.map((m) => (
                <td key={m} className={`px-2 text-right whitespace-nowrap ${(l.valores[m] ?? 0) < 0 ? "text-red-700" : ""}`}>{f(l.valores[m])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barras verticais simples (valores >= 0). */
export function Barras({ dados, formato }: { dados: { rotulo: string; valor: number; destaque?: boolean; dica?: string }[]; formato: (v: number) => string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="flex h-36 items-end gap-px" role="img" aria-label={`Gráfico de barras, máximo ${formato(max)}`}>
      {dados.map((d, i) => (
        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.dica ?? d.rotulo}: ${formato(d.valor)}`}>
          <div className={`rounded-t-sm ${d.destaque ? "bg-brand" : "bg-amber-300"} group-hover:bg-brand-dark`} style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor > 0 ? 2 : 0 }} />
          <span className="mt-1 truncate text-center text-[10px] text-stone-400">{d.rotulo}</span>
        </div>
      ))}
    </div>
  );
}
