"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { escolherFilial } from "@/app/(app)/lancar/actions";

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

export const inputCls =
  "h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-stone-100";

export const botaoCls =
  "h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50";

export const botaoSecCls =
  "h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50";

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
