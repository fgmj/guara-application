import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { filialAtual, getContexto } from "@/lib/contexto";
import { diffDias, fmtDia, fmtDiaCurto, hoje, isDia, paraDate, paraDia, somaDias } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { SITUACAO_TEXTO } from "@/lib/caixa";
import { listarProdutos, resumoDias } from "@/lib/resumo";
import { DiaNav, FilialSelect, Imprimir } from "@/components/ui";
import { botaoSecCls } from "@/components/estilos";

export const metadata = { title: "Relatório do dia · Guará" };

const DIAS_FUNCIONARIO = 7;
const ORIGEM = { CAIXA: "Caixa", CARTAO: "Cartão", CONTA: "Conta-corrente" } as const;
const RECEB = { CAIXA: "no caixa", CONTA: "na conta", DESCONTO: "desconto em pagamento" } as const;

function Secao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid overflow-hidden rounded-xl border border-stone-200 bg-white print:rounded-none print:border-stone-400">
      <div className="flex items-baseline justify-between gap-2 bg-stone-100 px-3 py-2 print:bg-stone-200">
        <h2 className="text-sm font-bold tracking-wide text-stone-700 uppercase">{titulo}</h2>
        <span className="text-sm font-semibold tabular-nums">{extra}</span>
      </div>
      {children}
    </section>
  );
}

const th = "px-3 py-1.5 text-right text-xs font-medium text-stone-500";
const td = "px-3 py-1.5 text-right";

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const ctx = await getContexto();
  const filialId = await filialAtual(ctx);
  if (!filialId) return <p className="rounded-lg bg-amber-50 p-4 text-sm">Seu usuário ainda não está vinculado a nenhuma filial.</p>;
  const hj = hoje();
  const { d } = await searchParams;
  let dia = isDia(d) && d <= hj ? d : hj;
  if (!ctx.gestor && diffDias(hj, dia) > DIAS_FUNCIONARIO) dia = hj;
  const data = paraDate(dia);
  const f = { filialId };

  const [produtos, [r], vendas, compras, despesas, valesDia, valesRec, caixa, formas] = await Promise.all([
    listarProdutos(false),
    resumoDias([filialId], dia, dia),
    prisma.venda.findMany({ where: { ...f, data }, include: { categoria: true, entregador: true } }),
    prisma.compra.findMany({ where: { ...f, data }, orderBy: { createdAt: "asc" } }),
    prisma.despesa.findMany({ where: { ...f, data }, include: { categoria: true }, orderBy: { createdAt: "asc" } }),
    prisma.vale.findMany({ where: { ...f, data }, orderBy: { createdAt: "asc" } }),
    prisma.vale.findMany({ where: { ...f, recebidoEm: data }, orderBy: { createdAt: "asc" } }),
    prisma.caixaDia.findUnique({ where: { filialId_data: { filialId, data } } }),
    prisma.formaRecebimento.findMany({ where: f, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
  ]);

  const filial = ctx.filiais.find((x) => x.id === filialId)!;
  const gas = produtos.filter((p) => p.tipo === "GAS");
  const principal = gas[0];
  const nomeProduto = new Map(produtos.map((p) => [p.id, p.nome]));
  const soma = (vs: typeof vendas) => ({ qtd: vs.reduce((s, v) => s + v.quantidade, 0), total: vs.reduce((s, v) => s + Number(v.total), 0) });

  // produto principal aberto por categoria; demais produtos em uma linha cada
  const doPrincipal = vendas.filter((v) => v.produtoId === principal?.id);
  const categorias = [...new Map(doPrincipal.map((v) => [v.categoriaId, v.categoria])).values()].sort((a, b) => a.ordem - b.ordem);
  const linhasCat = categorias.map((c) => ({ nome: c.nome, ...soma(doPrincipal.filter((v) => v.categoriaId === c.id)) }));
  const totalPrincipal = soma(doPrincipal);
  const outros = produtos
    .filter((p) => p.id !== principal?.id)
    .map((p) => ({ nome: p.nome, fixo: p.ativo && p.tipo !== "OUTRO", ...soma(vendas.filter((v) => v.produtoId === p.id)) }))
    .filter((p) => p.fixo || p.qtd > 0);
  const entregadores = [...new Map(vendas.map((v) => [v.entregadorId ?? "", v.entregador?.nome ?? "Sem entregador"])).entries()]
    .map(([id, nome]) => { const vs = vendas.filter((v) => (v.entregadorId ?? "") === id); return { nome, ...soma(vs), principal: soma(vs.filter((v) => v.produtoId === principal?.id)).qtd }; })
    .sort((a, b) => b.total - a.total);

  const sobra = r.caixa - r.esperado; // como na planilha: caixa − vendas
  const semCaixa = !caixa && r.temMovimento;
  const tom = !r.temMovimento ? "bg-stone-100 text-stone-600" : r.situacao === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700";
  const media = (x: { qtd: number; total: number }) => (x.qtd ? brl(x.total / x.qtd) : "");
  const formasUsadas = formas.filter((x) => x.ativo || r.formas[x.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-3 print:max-w-none print:space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Relatório do dia</h1>
          <p className="hidden text-base font-semibold print:block">{filial.nome} · {fmtDia(dia)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <FilialSelect filiais={ctx.filiais} atual={filialId} todas={false} />
          <DiaNav base="/dia" dia={dia} hoje={hj} minimo={ctx.gestor ? undefined : somaDias(hj, -DIAS_FUNCIONARIO)} rotulo={`${dia === hj ? "Hoje · " : ""}${fmtDiaCurto(dia)}`} />
        </div>
      </header>

      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${tom}`} role="status">
        <span>
          {!r.temMovimento ? "Sem movimento neste dia." : semCaixa ? "Caixa ainda não informado. " : r.situacao === "ok" ? "Caixa batendo. " : `${SITUACAO_TEXTO[r.situacao]} `}
          {r.temMovimento && Math.abs(sobra) >= 0.01 && <span className="tabular-nums">Diferença de {brl(Math.abs(sobra))} {sobra > 0 ? "a mais" : "a menos"} no caixa.</span>}
        </span>
        <span className="flex items-center gap-2">
          {r.temMovimento && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{caixa?.fechado ? `Fechado${caixa.fechadoPor ? ` por ${caixa.fechadoPor}` : ""}` : "Caixa aberto"}</span>}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
        {[
          ["Vendido", brl(r.vendaTotal)],
          [`${principal?.nome ?? "Botijões"} vendidos`, String(r.venda)],
          ["Preço médio", r.valorMedio ? brl(r.valorMedio) : "—"],
          ["Total do caixa", brl(r.caixa)],
        ].map(([rot, val]) => (
          <div key={rot} className="rounded-xl border border-stone-200 bg-white p-2.5">
            <p className="text-xs text-stone-500">{rot}</p>
            <p className="text-lg font-bold tabular-nums">{val}</p>
          </div>
        ))}
      </div>

      <Secao titulo="Vendas" extra={brl(r.vendaTotal)}>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-stone-200"><th className="px-3 py-1.5 text-left text-xs font-medium text-stone-500">{principal?.nome}</th><th className={th}>Qtd</th><th className={th}>Média</th><th className={th}>Total</th></tr>
          </thead>
          <tbody>
            {linhasCat.length === 0 && <tr><td colSpan={4} className="px-3 py-2 text-stone-500">Nenhuma venda de {principal?.nome} neste dia.</td></tr>}
            {linhasCat.map((l) => (
              <tr key={l.nome} className="border-b border-stone-100"><td className="px-3 py-1.5">{l.nome}</td><td className={td}>{l.qtd}</td><td className={`${td} text-stone-500`}>{media(l)}</td><td className={td}>{brl(l.total)}</td></tr>
            ))}
            <tr className="border-b border-stone-200 bg-stone-50 font-bold"><td className="px-3 py-1.5">TOTAL {principal?.nome}</td><td className={td}>{totalPrincipal.qtd}</td><td className={td}>{media(totalPrincipal)}</td><td className={td}>{brl(totalPrincipal.total)}</td></tr>
            {outros.map((l) => (
              <tr key={l.nome} className={`border-b border-stone-100 ${l.qtd ? "" : "text-stone-400"}`}><td className="px-3 py-1.5 text-[13px] sm:text-sm">{l.nome}</td><td className={td}>{l.qtd || ""}</td><td className={td}>{media(l)}</td><td className={td}>{l.qtd ? brl(l.total) : "—"}</td></tr>
            ))}
            {r.valesRecebidos > 0 && <tr className="border-b border-stone-100"><td className="px-3 py-1.5" colSpan={3}>Vales recebidos no caixa</td><td className={td}>{brl(r.valesRecebidos)}</td></tr>}
            <tr className="bg-stone-100 text-base font-bold print:bg-stone-200"><td className="px-3 py-2 text-right" colSpan={3}>TOTAL GERAL</td><td className={`${td} py-2`}>{brl(r.esperado)}</td></tr>
          </tbody>
        </table>
      </Secao>

      <Secao titulo="Contagem">
        <table className="w-full text-center text-sm tabular-nums">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th rowSpan={2} className="px-3 py-1.5 text-left font-medium">Produto</th>
              <th colSpan={4} className="border-l border-stone-200 py-1 font-semibold">Cheios</th>
              <th colSpan={3} className="border-l border-stone-200 py-1 font-semibold">Contagem final</th>
            </tr>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th className="border-l border-stone-200 py-1 font-medium">Inicial</th><th className="font-medium">Entrada</th><th className="font-medium">Saída</th><th className="font-medium">Final</th>
              <th className="border-l border-stone-200 font-medium">Cheio</th><th className="font-medium">Vazio</th><th className="font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {gas.filter((p) => p.ativo || r.cheios[p.id] || r.cascos[p.id]).map((p) => {
              const ent = r.comprados[p.id] ?? 0, sai = r.vendidos[p.id] ?? 0, fim = r.cheios[p.id] ?? 0, tot = Math.max(r.cascos[p.id] ?? 0, fim);
              return (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-1.5 text-left font-semibold">{p.nome}</td>
                  <td className="border-l border-stone-200">{fim - ent + sai}</td><td>{ent || ""}</td><td>{sai || ""}</td><td className="font-bold">{fim}</td>
                  <td className="border-l border-stone-200 font-bold">{fim}</td><td>{tot - fim}</td><td>{tot}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Secao>

      <Secao titulo="Caixa" extra={brl(r.caixa)}>
        <dl className="grid grid-cols-1 gap-x-6 px-3 py-2 text-sm tabular-nums sm:grid-cols-2 print:grid-cols-2">
          {formasUsadas.map((x) => (
            <div key={x.id} className="flex justify-between border-b border-stone-100 py-1"><dt>{x.nome}</dt><dd>{r.formas[x.id] ? brl(r.formas[x.id]) : "—"}</dd></div>
          ))}
          <div className="flex justify-between border-b border-stone-100 py-1"><dt>Vales a receber</dt><dd>{r.valesEmitidos ? brl(r.valesEmitidos) : "—"}</dd></div>
          <div className="flex justify-between border-b border-stone-100 py-1"><dt>Despesas pagas com o caixa</dt><dd>{r.despesasCaixa ? brl(r.despesasCaixa) : "—"}</dd></div>
        </dl>
        <div className="grid grid-cols-3 border-t border-stone-200 text-center text-sm tabular-nums">
          <div className="p-2"><p className="text-xs text-stone-500">Total geral (vendas)</p><p className="font-bold">{brl(r.esperado)}</p></div>
          <div className="border-x border-stone-200 p-2"><p className="text-xs text-stone-500">Total do caixa</p><p className="font-bold">{brl(r.caixa)}</p></div>
          <div className="p-2"><p className="text-xs text-stone-500">Diferença</p><p className={`font-bold ${r.temMovimento && r.situacao !== "ok" ? "text-red-700" : ""}`}>{brl(sobra)}</p></div>
        </div>
        {caixa?.obs && <p className="border-t border-stone-200 px-3 py-2 text-sm"><span className="text-stone-500">Observação:</span> {caixa.obs}</p>}
      </Secao>

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        <Secao titulo="Por entregador">
          <ul className="px-3 py-1 text-sm tabular-nums">
            {entregadores.length === 0 && <li className="py-1 text-stone-500">Sem vendas.</li>}
            {entregadores.map((e) => (
              <li key={e.nome} className="flex justify-between gap-2 border-b border-stone-100 py-1 last:border-0"><span>{e.nome}</span><span className="text-stone-500">{e.principal > 0 ? `${e.principal} ${principal?.nome}` : ""}</span><span className="font-medium">{brl(e.total)}</span></li>
            ))}
          </ul>
        </Secao>
        <Secao titulo="Compras" extra={compras.length ? brl(compras.reduce((s, c) => s + Number(c.valor), 0)) : ""}>
          <ul className="px-3 py-1 text-sm tabular-nums">
            {compras.length === 0 && <li className="py-1 text-stone-500">Sem compras.</li>}
            {compras.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 border-b border-stone-100 py-1 last:border-0"><span>{c.quantidade} × {nomeProduto.get(c.produtoId)} <span className="text-stone-400">{c.fornecedor ?? ""}</span></span><span className="font-medium">{brl(Number(c.valor))}</span></li>
            ))}
          </ul>
        </Secao>
        <Secao titulo="Despesas" extra={despesas.length ? brl(r.despesas) : ""}>
          <ul className="px-3 py-1 text-sm tabular-nums">
            {despesas.length === 0 && <li className="py-1 text-stone-500">Sem despesas.</li>}
            {despesas.map((x) => (
              <li key={x.id} className="flex justify-between gap-2 border-b border-stone-100 py-1 last:border-0"><span className="min-w-0">{x.descricao} <span className="text-stone-400">· {x.categoria.nome} · {ORIGEM[x.origem]}</span></span><span className="font-medium">{brl(Number(x.valor))}</span></li>
            ))}
          </ul>
        </Secao>
        <Secao titulo="Vales" extra={valesDia.length ? brl(r.valesEmitidos) : ""}>
          <ul className="px-3 py-1 text-sm tabular-nums">
            {valesDia.length + valesRec.length === 0 && <li className="py-1 text-stone-500">Sem vales.</li>}
            {valesDia.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 border-b border-stone-100 py-1 last:border-0"><span>{v.descricao} <span className="text-stone-400">· lançado{v.recebidoEm ? " · já recebido" : ""}</span></span><span className="font-medium">{brl(Number(v.valor))}</span></li>
            ))}
            {valesRec.map((v) => (
              <li key={`r${v.id}`} className="flex justify-between gap-2 border-b border-stone-100 py-1 last:border-0"><span>{v.descricao} <span className="text-emerald-700">· recebido {v.recebimento ? RECEB[v.recebimento] : ""} (de {fmtDia(paraDia(v.data)).slice(0, 5)})</span></span><span className="font-medium">{brl(Number(v.valor))}</span></li>
            ))}
          </ul>
        </Secao>
      </div>

      <div className="hidden pt-10 text-sm print:flex print:justify-end"><span className="w-64 border-t border-stone-500 pt-1 text-center">Visto</span></div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href={dia === hj ? "/lancar" : `/lancar?d=${dia}`} className={`${botaoSecCls} flex h-10 items-center`}>Ver ou corrigir lançamentos</Link>
        <Imprimir />
      </div>
    </div>
  );
}
