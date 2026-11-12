"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { receberVale } from "../lancar/actions";

export function BotaoReceber({ id, hoje }: { id: string; hoje: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  return (
    <select
      aria-label="Marcar como recebido"
      value=""
      disabled={pendente}
      onChange={(e) => {
        const como = e.target.value as "CAIXA" | "CONTA" | "DESCONTO";
        if (como) start(async () => { const r = await receberVale(id, hoje, como); if ("erro" in r) alert(r.erro); router.refresh(); });
      }}
      className="h-8 rounded-lg border border-stone-300 bg-white px-2 text-xs font-medium"
    >
      <option value="">Receber hoje…</option>
      <option value="CAIXA">No caixa do dia</option>
      <option value="CONTA">Na conta (Pix/transferência)</option>
      <option value="DESCONTO">Descontado do pagamento</option>
    </select>
  );
}
