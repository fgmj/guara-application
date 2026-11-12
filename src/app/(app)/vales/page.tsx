import { prisma } from "@/lib/prisma";
import { exigirGestor, filialAtual, idsDaSelecao } from "@/lib/contexto";
import { diffDias, fmtDia, hoje, paraDia } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { Bloco, Titulo } from "@/components/relatorio";
import { FilialSelect } from "@/components/ui";
import { BotaoReceber } from "./receber";

export const metadata = { title: "Vales · Guará" };

export default async function Page() {
  const ctx = await exigirGestor();
  const sel = await filialAtual(ctx, true);
  const hj = hoje();
  const vales = await prisma.vale.findMany({ where: { filialId: { in: idsDaSelecao(ctx, sel) }, recebidoEm: null }, orderBy: { data: "asc" }, include: { filial: true } });
  const grupos = new Map<string, typeof vales>();
  for (const v of vales) grupos.set(v.descricao.trim(), [...(grupos.get(v.descricao.trim()) ?? []), v]);
  const total = vales.reduce((s, v) => s + Number(v.valor), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Titulo extra={<FilialSelect filiais={ctx.filiais} atual={sel} todas />}>Vales a receber · {brl(total)}</Titulo>
      {grupos.size === 0 && <p className="text-sm text-stone-500">Nenhum vale em aberto.</p>}
      {[...grupos.entries()].map(([nome, vs]) => (
        <Bloco key={nome} titulo={`${nome} · ${brl(vs.reduce((s, v) => s + Number(v.valor), 0))}`}>
          <ul className="text-sm">
            {vs.map((v) => {
              const dias = diffDias(hj, paraDia(v.data));
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-100 py-1.5 first:border-0">
                  <span className="tabular-nums">{fmtDia(paraDia(v.data))}</span>
                  <span className={`text-xs ${dias > 30 ? "font-semibold text-red-700" : "text-stone-500"}`}>{dias} dia(s)</span>
                  <span className="min-w-0 flex-1 truncate text-stone-500">{sel === "todas" ? v.filial.nome : ""} {v.obs ?? ""}</span>
                  <span className="font-medium tabular-nums">{brl(Number(v.valor))}</span>
                  <BotaoReceber id={v.id} hoje={hj} />
                </li>
              );
            })}
          </ul>
        </Bloco>
      ))}
    </div>
  );
}
