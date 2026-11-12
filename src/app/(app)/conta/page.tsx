"use client";

import { useActionState } from "react";
import { botaoCls, inputCls } from "@/components/ui";
import { trocarSenha } from "../cadastros/actions";

export default function Page() {
  const [estado, acao, pendente] = useActionState(trocarSenha, { msg: "" });
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-bold">Minha senha</h1>
      <form action={acao} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="block text-xs font-medium text-stone-500">Senha atual<input name="atual" type="password" required autoComplete="current-password" className={inputCls} /></label>
        <label className="block text-xs font-medium text-stone-500">Nova senha (mínimo 8 caracteres)<input name="nova" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></label>
        <button disabled={pendente} className={`${botaoCls} w-full`}>Alterar senha</button>
        {estado.msg && <p role="status" className={`text-sm ${estado.ok ? "text-emerald-700" : "text-red-700"}`}>{estado.msg}</p>}
      </form>
    </div>
  );
}
