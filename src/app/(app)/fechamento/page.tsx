import Link from "next/link";
import { exigirGestor, filialAtual, idsDaSelecao } from "@/lib/contexto";
import { fimMes, fmtDiaCurto, hoje, inicioMes, isMes } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { relatorioMensal } from "@/lib/relatorios";
import { listarProdutos, resumoDias } from "@/lib/resumo";
import { Bloco, Matriz, MesNav, Titulo } from "@/components/relatorio";
import { FilialSelect } from "@/components/ui";

export const metadata = { title: "Fechamento · Guará" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await exigirGestor();
  const sel = await filialAtual(ctx, true);
  const ids = idsDaSelecao(ctx, sel);
  const hj = hoje();
  const mesAtual = hj.slice(0, 7);
  const { m } = await searchParams;
  const mes = isMes(m) && m <= mesAtual ? m : mesAtual;
  const ate = mes === mesAtual ? hj : fimMes(mes);
  const [dias, rel, produtos] = await Promise.all([resumoDias(ids, inicioMes(mes), ate), relatorioMensal(ids, [mes]), listarProdutos()]);
  const p = produtos.find((x) => x.tipo === "GAS")?.nome ?? "Botijão";
  const t = (f: (d: (typeof dias)[number]) => number) => dias.reduce((a, d) => a + f(d), 0);
  let acumulado = 0;

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <Titulo extra={<><FilialSelect filiais={ctx.filiais} atual={sel} todas /><MesNav base="/fechamento" mes={mes} atual={mesAtual} /></>}>Fechamento</Titulo>
      <Bloco titulo="Resumo diário" nota="Diferença = vendas + vales recebidos − caixa. Toque no dia para abrir o relatório completo.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-right text-xs whitespace-nowrap text-stone-500">
                <th className="text-left font-medium">Dia</th><th className="px-1.5 font-medium">{p} inicial</th><th className="px-1.5 font-medium">Compra</th><th className="px-1.5 font-medium">Venda</th><th className="px-1.5 font-medium">Final</th>
                <th className="px-1.5 font-medium">Preço médio</th><th className="px-1.5 font-medium">Venda total</th><th className="px-1.5 font-medium">Vales receb.</th><th className="px-1.5 font-medium">Caixa</th><th className="px-1.5 font-medium">Diferença</th>
                <th className="px-1.5 font-medium">Resultado</th><th className="px-1.5 font-medium">Acumulado</th><th className="pl-2 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                acumulado += d.liquido;
                const ruim = d.temMovimento && d.situacao !== "ok";
                return (
                  <tr key={d.dia} className={`border-t border-stone-100 text-right whitespace-nowrap ${ruim ? "bg-red-50" : ""}`}>
                    <td className="py-1 text-left"><Link href={`/dia?d=${d.dia}`} className="text-brand underline">{fmtDiaCurto(d.dia)}</Link></td>
                    <td className="px-1.5">{d.inicial}</td><td className="px-1.5">{d.compra || ""}</td><td className="px-1.5 font-semibold">{d.venda || ""}</td><td className="px-1.5">{d.final}</td>
                    <td className="px-1.5">{d.valorMedio ? brl(d.valorMedio) : ""}</td><td className="px-1.5">{brl(d.vendaTotal)}</td><td className="px-1.5">{d.valesRecebidos ? brl(d.valesRecebidos) : ""}</td>
                    <td className="px-1.5">{brl(d.caixa)}</td><td className={`px-1.5 ${ruim ? "font-semibold text-red-700" : ""}`}>{brl(d.diferenca)}</td>
                    <td className={`px-1.5 ${d.liquido < 0 ? "text-red-700" : ""}`}>{brl(d.liquido)}</td><td className={`px-1.5 ${acumulado < 0 ? "text-red-700" : ""}`}>{brl(acumulado)}</td>
                    <td className="pl-2 text-left text-xs">{!d.temMovimento ? <span className="text-stone-400">sem movimento</span> : ruim ? <span className="text-red-700">{d.situacao === "falta" ? "falta no caixa" : "sobra no caixa"}</span> : d.fechado ? <span className="text-emerald-700">fechado</span> : <span className="text-amber-700">aberto</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 text-right font-semibold whitespace-nowrap">
                <td className="py-1 text-left">Total</td><td></td><td className="px-1.5">{t((d) => d.compra)}</td><td className="px-1.5">{t((d) => d.venda)}</td><td></td><td></td>
                <td className="px-1.5">{brl(t((d) => d.vendaTotal))}</td><td className="px-1.5">{brl(t((d) => d.valesRecebidos))}</td><td className="px-1.5">{brl(t((d) => d.caixa))}</td><td className="px-1.5">{brl(t((d) => d.diferenca))}</td><td className="px-1.5">{brl(t((d) => d.liquido))}</td><td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Bloco>
      <Bloco titulo="Fechamento mensal: total do caixa" nota="Quanto entrou por forma de recebimento no mês.">
        <Matriz meses={[mes]} linhas={rel.caixa} vazio="Nenhum caixa informado neste mês." />
      </Bloco>
    </div>
  );
}
