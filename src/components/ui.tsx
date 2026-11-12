"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { escolherFilial } from "@/app/(app)/lancar/actions";
import { botaoSecCls } from "@/components/estilos";

export function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { id: T; nome: string }[];
  valor: T | null;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors ${
            valor === o.id
              ? "border-brand bg-brand text-white"
              : "border-stone-300 bg-white text-stone-700 hover:border-brand hover:text-brand"
          }`}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Campo({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-stone-500 ${className}`}>
      <span className="mb-1 block">{rotulo}</span>
      {children}
    </label>
  );
}

export function FilialSelect({
  filiais,
  atual,
  todas,
}: {
  filiais: { id: string; nome: string }[];
  atual: string | null;
  todas: boolean;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  if (filiais.length <= 1) return <span className="text-sm font-medium">{filiais[0]?.nome ?? "Sem filial"}</span>;
  return (
    <select
      aria-label="Filial"
      value={atual ?? ""}
      disabled={pendente}
      onChange={(e) => start(async () => { await escolherFilial(e.target.value); router.refresh(); })}
      className="h-9 max-w-full rounded-lg border border-stone-300 bg-white px-2 text-sm font-medium"
    >
      {todas && <option value="todas">Todas as filiais</option>}
      {filiais.map((f) => (
        <option key={f.id} value={f.id}>{f.nome}</option>
      ))}
    </select>
  );
}

/** Navegação por dia: anterior, seletor de data, próximo. `base` recebe ?d=AAAA-MM-DD. */
export function DiaNav({ base, dia, hoje, minimo, rotulo }: { base: string; dia: string; hoje: string; minimo?: string; rotulo: string }) {
  const router = useRouter();
  const ir = (d: string) => router.push(d === hoje ? base : `${base}?d=${d}`);
  const soma = (n: number) => { const x = new Date(`${dia}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const b = "size-10 rounded-lg border border-stone-300 bg-white text-lg disabled:opacity-30";
  return (
    <div className="flex items-center gap-1 print:hidden">
      <button type="button" aria-label="Dia anterior" disabled={!!minimo && dia <= minimo} onClick={() => ir(soma(-1))} className={b}>‹</button>
      <label className="relative">
        <span className="flex h-10 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold whitespace-nowrap">{rotulo}</span>
        <input type="date" aria-label="Data" value={dia} min={minimo} max={hoje} onChange={(e) => e.target.value && ir(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button type="button" aria-label="Próximo dia" disabled={dia >= hoje} onClick={() => ir(soma(1))} className={b}>›</button>
    </div>
  );
}

export function Imprimir() {
  return <button type="button" onClick={() => window.print()} className={`${botaoSecCls} h-10 print:hidden`}>Imprimir</button>;
}
