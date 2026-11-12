import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirGestor, filialAtual, idsDaSelecao } from "@/lib/contexto";
import { fimMes, hoje, inicioMes, isMes, rotuloMes, somaDias } from "@/lib/datas";
import { brl, num } from "@/lib/dinheiro";
import { historico, ultimosMeses } from "@/lib/relatorios";
import { listarProdutos, projetar, resumoDias } from "@/lib/resumo";
import { Barras, Bloco, Kpi, MesNav, Titulo } from "@/components/relatorio";
import { FilialSelect } from "@/components/ui";

export const metadata = { title: "Painel · Guará" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await exigirGestor();
  const sel = await filialAtual(ctx, true);
  const ids = idsDaSelecao(ctx, sel);
  const hj = hoje();
  const mesAtual = hj.slice(0, 7);
  const { m } = await searchParams;
  const mes = isMes(m) && m <= mesAtual ? m : mesAtual;
  const fim = fimMes(mes);
  const ate = mes === mesAtual ? hj : fim;
  const meses = ultimosMeses(mes, 6);

  const [dias, hist, produtos, valesAbertos, estoques] = await Promise.all([
    resumoDias(ids, somaDias(inicioMes(mes), -7), ate),
    historico(ids, meses),
    listarProdutos(),
    prisma.vale.aggregate({ where: { filialId: { in: ids }, recebidoEm: null }, _sum: { valor: true }, _count: true }),
    Promise.all(ctx.filiais.filter((f) => ids.includes(f.id)).map(async (f) => ({ f, r: (await resumoDias([f.id], hj, hj))[0] }))),
  ]);
  const doMes = dias.filter((d) => d.dia >= inicioMes(mes));
  const soma = (f: (d: (typeof dias)[number]) => number) => doMes.reduce((a, d) => a + f(d), 0);
  const vendas = soma((d) => d.vendaTotal);
  const qtd = soma((d) => d.venda);
  const despesas = soma((d) => d.despesas);
  const liquido = soma((d) => d.liquido);
  const diasMes = Number(fim.slice(8));
  const corridos = doMes.length;
  const media7 = dias.slice(-7).reduce((a, d) => a + d.venda, 0) / 7;
  const pendencias = doMes.filter((d) => d.temMovimento && d.situacao !== "ok");
  const semFechar = doMes.filter((d) => d.temMovimento && !d.fechado && d.dia < hj);
  const principal = produtos.find((p) => p.tipo === "GAS");
  const gas = produtos.filter((p) => p.tipo === "GAS");
  const emCurso = mes === mesAtual && corridos < diasMes;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Titulo extra={<><FilialSelect filiais={ctx.filiais} atual={sel} todas /><MesNav base="/painel" mes={mes} atual={mesAtual} /></>}>Painel</Titulo>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo={`Vendas em ${rotuloMes(mes)}`} valor={brl(vendas)} nota={emCurso ? `Projeção: ${brl(projetar(vendas, corridos, diasMes))}` : undefined} />
        <Kpi rotulo={`${principal?.nome ?? "Botijões"} vendidos`} valor={num(qtd)} nota={emCurso ? `Projeção: ${num(Math.round(projetar(qtd, corridos, diasMes)))} · média 7 dias: ${num(Math.round(media7 * 10) / 10)}/dia` : `${num(Math.round((qtd / Math.max(1, corridos)) * 10) / 10)}/dia`} />
        <Kpi rotulo="Despesas" valor={brl(despesas)} nota={emCurso ? `Projeção: ${brl(projetar(despesas, corridos, diasMes))}` : undefined} />
        <Kpi rotulo="Resultado (margem − despesas)" valor={brl(liquido)} tom={liquido < 0 ? "ruim" : "bom"} nota={emCurso ? `Projeção: ${brl(projetar(liquido, corridos, diasMes))}` : undefined} />
      </div>
      <Bloco titulo={`${principal?.nome ?? "Botijões"} vendidos por dia`}>
        <Barras formato={(v) => `${num(v)} un`} dados={doMes.map((d) => ({ rotulo: d.dia.slice(8), valor: d.venda, destaque: d.dia === hj, dica: `${d.dia.slice(8)}/${d.dia.slice(5, 7)}` }))} />
      </Bloco>
      <div className="grid gap-3 md:grid-cols-2">
        <Bloco titulo="Fechamento do caixa" nota={`${semFechar.length} dia(s) sem fechar · ${pendencias.length} com diferença`}>
          {pendencias.length === 0 && <p className="text-sm text-emerald-700">Todos os dias do mês estão batendo.</p>}
          <ul className="text-sm">
            {pendencias.slice(-8).reverse().map((d) => (
              <li key={d.dia} className="flex justify-between border-t border-stone-100 py-1 first:border-0">
                <Link href={`/dia?d=${d.dia}`} className="text-brand underline">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</Link>
                <span className="text-stone-500">{d.situacao === "falta" ? "falta no caixa" : "sobra no caixa"}</span>
                <span className="font-medium text-red-700 tabular-nums">{brl(Math.abs(d.diferenca))}</span>
              </li>
            ))}
          </ul>
          <Link href={`/fechamento?m=${mes}`} className="mt-2 inline-block text-sm text-brand underline">Ver fechamento do mês</Link>
        </Bloco>
        <Bloco titulo="Estoque agora" nota={`Vales a receber: ${brl(Number(valesAbertos._sum.valor ?? 0))} em ${valesAbertos._count} vale(s)`}>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-stone-500"><tr><th className="text-left font-medium">Filial</th>{gas.map((p) => <th key={p.id} className="text-right font-medium">{p.nome}</th>)}</tr></thead>
            <tbody>
              {estoques.map(({ f, r }) => (
                <tr key={f.id} className="border-t border-stone-100">
                  <td className="py-1">{f.nome}</td>
                  {gas.map((p) => <td key={p.id} className="text-right"><b>{r.cheios[p.id] ?? 0}</b><span className="text-stone-400"> + {Math.max(0, (r.cascos[p.id] ?? 0) - (r.cheios[p.id] ?? 0))} vz</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/estoque" className="mt-2 inline-block text-sm text-brand underline">Ver estoque</Link>
        </Bloco>
      </div>
      <Bloco titulo="Últimos meses">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-stone-500"><tr><th className="text-left font-medium">Mês</th><th className="text-right font-medium">{principal?.nome}</th><th className="text-right font-medium">Vendas</th><th className="text-right font-medium">Margem bruta</th><th className="text-right font-medium">Despesas</th><th className="text-right font-medium">Resultado</th></tr></thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.mes} className="border-t border-stone-100">
                  <td className="py-1"><Link href={`/painel?m=${h.mes}`} className="text-brand underline">{rotuloMes(h.mes)}</Link></td>
                  <td className="text-right">{num(h.qtd)}</td><td className="text-right">{brl(h.vendas)}</td><td className="text-right">{brl(h.bruto)}</td><td className="text-right">{brl(h.despesas)}</td>
                  <td className={`text-right font-semibold ${h.liquido < 0 ? "text-red-700" : "text-emerald-700"}`}>{brl(h.liquido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
}
