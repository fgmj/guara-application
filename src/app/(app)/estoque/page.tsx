import { prisma } from "@/lib/prisma";
import { exigirGestor, filialAtual } from "@/lib/contexto";
import { fmtDia, hoje, paraDia } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { listarProdutos, resumoDias } from "@/lib/resumo";
import { Bloco, Titulo } from "@/components/relatorio";
import { FilialSelect, botaoCls, inputCls } from "@/components/ui";
import { marcarCompraPaga, salvarContagem } from "./actions";

export const metadata = { title: "Estoque · Guará" };

export default async function Page() {
  const ctx = await exigirGestor();
  const filialId = await filialAtual(ctx);
  if (!filialId) return <p>Cadastre uma filial primeiro.</p>;
  const hj = hoje();
  const [produtos, [r], ajustes, compras] = await Promise.all([
    listarProdutos(),
    resumoDias([filialId], hj, hj),
    prisma.ajusteEstoque.findMany({ where: { filialId }, orderBy: { createdAt: "desc" }, take: 12, include: { produto: true } }),
    prisma.compra.findMany({ where: { filialId, valor: { gt: 0 } }, orderBy: [{ pagoEm: { sort: "desc", nulls: "first" } }, { data: "desc" }], take: 30, include: { produto: true } }),
  ]);
  const gas = produtos.filter((p) => p.tipo === "GAS");
  const num = `${inputCls} h-9 w-20 text-center`;

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <Titulo extra={<FilialSelect filiais={ctx.filiais} atual={filialId} todas={false} />}>Estoque</Titulo>
      <Bloco titulo="Posição atual e contagem" nota="O estoque é calculado: compras entram, vendas saem. Para acertar com a contagem física, preencha o que foi contado e salve.">
        <form action={salvarContagem.bind(null, filialId)}>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-stone-500"><tr><th className="text-left font-medium">Produto</th><th className="font-medium">Cheios</th><th className="font-medium">Vazios</th><th className="font-medium">Total</th><th className="font-medium">Contei cheios</th><th className="font-medium">Contei vazios</th></tr></thead>
            <tbody>
              {gas.map((p) => {
                const ch = r.cheios[p.id] ?? 0, tot = r.cascos[p.id] ?? 0;
                return (
                  <tr key={p.id} className="border-t border-stone-100 text-center">
                    <td className="py-1.5 text-left font-medium">{p.nome}</td><td className="text-base font-bold">{ch}</td><td>{Math.max(0, tot - ch)}</td><td>{Math.max(tot, ch)}</td>
                    <td><input name={`cheios-${p.id}`} aria-label={`${p.nome}: cheios contados`} inputMode="numeric" className={num} /></td>
                    <td><input name={`vazios-${p.id}`} aria-label={`${p.nome}: vazios contados`} inputMode="numeric" className={num} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <input name="motivo" placeholder="Motivo (ex.: contagem mensal, estoque inicial)" className={`${inputCls} min-w-40 flex-1`} />
            <button className={botaoCls}>Salvar contagem</button>
          </div>
        </form>
      </Bloco>
      <Bloco titulo="Compras e pagamentos" nota="Últimas compras com valor. Marque quando o boleto for pago.">
        <ul className="text-sm">
          {compras.length === 0 && <li className="text-stone-500">Nenhuma compra lançada.</li>}
          {compras.map((c) => {
            const venc = c.vencimento ? paraDia(c.vencimento) : null;
            const atrasada = !c.pagoEm && venc && venc < hj;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-1.5 first:border-0">
                <span className="w-20 tabular-nums">{fmtDia(paraDia(c.data)).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate">{c.quantidade} × {c.produto.nome}<span className="text-stone-400"> {c.fornecedor ?? ""} {c.pagamento ?? ""} {c.nota ? `NF ${c.nota}` : ""}</span></span>
                <span className="font-medium tabular-nums">{brl(Number(c.valor))}</span>
                <span className={`w-28 text-xs ${atrasada ? "font-semibold text-red-700" : "text-stone-500"}`}>{c.pagoEm ? `pago ${fmtDia(paraDia(c.pagoEm)).slice(0, 5)}` : venc ? `vence ${fmtDia(venc).slice(0, 5)}` : "sem vencimento"}</span>
                <form action={marcarCompraPaga.bind(null, c.id, !c.pagoEm)}><button className="text-xs text-brand underline">{c.pagoEm ? "desfazer" : "marcar pago"}</button></form>
              </li>
            );
          })}
        </ul>
      </Bloco>
      <Bloco titulo="Últimos ajustes de contagem">
        <ul className="text-sm">
          {ajustes.length === 0 && <li className="text-stone-500">Nenhum ajuste.</li>}
          {ajustes.map((a) => (
            <li key={a.id} className="flex gap-3 border-t border-stone-100 py-1 first:border-0">
              <span className="tabular-nums">{fmtDia(paraDia(a.data))}</span><span className="flex-1">{a.produto.nome} <span className="text-stone-400">· {a.motivo} · {a.criadoPor}</span></span>
              <span className={`font-semibold tabular-nums ${a.quantidade < 0 ? "text-red-700" : "text-emerald-700"}`}>{a.quantidade > 0 ? "+" : ""}{a.quantidade}</span>
            </li>
          ))}
        </ul>
      </Bloco>
    </div>
  );
}
