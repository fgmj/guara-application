import { exigirGestor, filialAtual, idsDaSelecao } from "@/lib/contexto";
import { hoje, isMes } from "@/lib/datas";
import { relatorioMensal, somar, ultimosMeses } from "@/lib/relatorios";
import { Bloco, Matriz, MesNav, Titulo } from "@/components/relatorio";
import { FilialSelect } from "@/components/ui";

export const metadata = { title: "Relatórios · Guará" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await exigirGestor();
  const sel = await filialAtual(ctx, true);
  const mesAtual = hoje().slice(0, 7);
  const { m } = await searchParams;
  const mes = isMes(m) && m <= mesAtual ? m : mesAtual;
  const meses = ultimosMeses(mes, 6);
  const r = await relatorioMensal(idsDaSelecao(ctx, sel), meses);

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Titulo extra={<><FilialSelect filiais={ctx.filiais} atual={sel} todas /><MesNav base="/relatorios" mes={mes} atual={mesAtual} /></>}>Relatórios · últimos 6 meses</Titulo>
      <Bloco titulo="Resultado mensal" nota="Receita das vendas − custo dos produtos (cadastro de produtos) − despesas."><Matriz meses={meses} linhas={r.dre} /></Bloco>
      <Bloco titulo="Venda por categoria (botijões)"><Matriz meses={meses} dinheiro={false} linhas={r.vendasQtd.length ? [...r.vendasQtd, somar(r.vendasQtd, "Total")] : []} /></Bloco>
      <Bloco titulo="Venda por categoria (R$)"><Matriz meses={meses} linhas={r.vendasTotal.length ? [...r.vendasTotal, somar(r.vendasTotal, "Total")] : []} /></Bloco>
      <Bloco titulo="Venda por entregador (botijões)"><Matriz meses={meses} dinheiro={false} linhas={r.entregadores} /></Bloco>
      <Bloco titulo="Venda por produto (unidades)"><Matriz meses={meses} dinheiro={false} linhas={r.produtos} /></Bloco>
      <Bloco titulo="Despesas por categoria" nota="As subcategorias aparecem logo abaixo da categoria e já estão somadas nela."><Matriz meses={meses} linhas={r.despesas.length ? [...r.despesas, r.totalDesp] : []} /></Bloco>
      <Bloco titulo="Total do caixa por forma de recebimento"><Matriz meses={meses} linhas={r.caixa} /></Bloco>
    </div>
  );
}
