"use client";

import { useActionState } from "react";
import { botaoCls, inputCls } from "@/components/ui";
import { importarPlanilha } from "./actions";

export function FormImportar({ filiais }: { filiais: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState(importarPlanilha, {});
  return (
    <form action={acao} className="space-y-3">
      <label className="block text-xs font-medium text-stone-500">Filial
        <select name="filialId" required defaultValue="" className={inputCls}>
          <option value="" disabled>Escolha…</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-stone-500">Arquivo da planilha (.xlsx)
        <input name="arquivo" type="file" accept=".xlsx" required className={`${inputCls} py-2 text-sm`} />
      </label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmo" className="mt-1" /> Entendo que os lançamentos atuais desta filial serão apagados e substituídos pelos da planilha.</label>
      <button disabled={pendente} className={botaoCls}>{pendente ? "Importando… pode levar um minuto" : "Importar"}</button>
      {estado.erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
      {estado.ok && <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{estado.ok.map((l) => <p key={l}>{l}</p>)}</div>}
    </form>
  );
}
