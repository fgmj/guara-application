import { prisma } from "@/lib/prisma";
import { filialAtual, getContexto } from "@/lib/contexto";
import { diffDias, hoje, isDia, paraDate, paraDia } from "@/lib/datas";
import { listarProdutos, resumoDias } from "@/lib/resumo";
import { FilialSelect } from "@/components/ui";
import { Lancar } from "./lancar";

export const metadata = { title: "Lançamentos · Guará" };

const distintos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x).map((x) => x.trim()))].slice(0, 40);

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const ctx = await getContexto();
  const filialId = await filialAtual(ctx);
  if (!filialId) {
    return <p className="rounded-lg bg-amber-50 p-4 text-sm">Seu usuário ainda não está vinculado a nenhuma filial. Peça ao gestor para liberar o acesso.</p>;
  }
  const hj = hoje();
  const { d } = await searchParams;
  let dia = isDia(d) && d <= hj ? d : hj;
  if (!ctx.gestor && diffDias(hj, dia) > 7) dia = hj;
  const data = paraDate(dia);
  const f = { filialId };

  const [produtos, categorias, entregadores, formas, catsDespesa, vendas, compras, vales, despesas, caixa, resumo, recVales, recCompras, recDespesas] =
    await Promise.all([
      listarProdutos(),
      prisma.categoriaVenda.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } }),
      prisma.entregador.findMany({ where: { ...f, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.formaRecebimento.findMany({ where: { ...f, ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } }),
      prisma.categoriaDespesa.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.venda.findMany({ where: { ...f, data }, orderBy: { createdAt: "asc" } }),
      prisma.compra.findMany({ where: { ...f, data }, orderBy: { createdAt: "asc" } }),
      prisma.vale.findMany({ where: { ...f, OR: [{ data }, { recebidoEm: null }, { recebidoEm: data }] }, orderBy: [{ data: "asc" }, { createdAt: "asc" }] }),
      prisma.despesa.findMany({ where: { ...f, data }, orderBy: { createdAt: "asc" } }),
      prisma.caixaDia.findUnique({ where: { filialId_data: { filialId, data } } }),
      resumoDias([filialId], dia, dia),
      prisma.vale.findMany({ where: f, orderBy: { createdAt: "desc" }, take: 300, select: { descricao: true } }),
      prisma.compra.findMany({ where: f, orderBy: { createdAt: "desc" }, take: 100, select: { fornecedor: true, pagamento: true } }),
      prisma.despesa.findMany({ where: f, orderBy: { createdAt: "desc" }, take: 400, select: { descricao: true, subcategoria: true, placa: true } }),
    ]);

  const fechado = !!caixa?.fechado;
  return (
    <div className="mx-auto max-w-3xl">
      <Lancar
        key={`${filialId}-${dia}`}
        seletor={<FilialSelect filiais={ctx.filiais} atual={filialId} todas={false} />}
        d={{
          filialId,
          dia,
          hoje: hj,
          gestor: ctx.gestor,
          fechado,
          podeEditar: ctx.gestor || !fechado,
          diasAtras: ctx.gestor ? 100000 : 7,
          produtos,
          categorias,
          entregadores,
          formas,
          catsDespesa,
          vendas: vendas.map((v) => ({ id: v.id, categoriaId: v.categoriaId, entregadorId: v.entregadorId, produtoId: v.produtoId, quantidade: v.quantidade, valorUnit: Number(v.valorUnit), total: Number(v.total) })),
          compras: compras.map((c) => ({ id: c.id, produtoId: c.produtoId, quantidade: c.quantidade, valor: Number(c.valor), fornecedor: c.fornecedor, pagamento: c.pagamento, nota: c.nota })),
          vales: vales.map((v) => ({ id: v.id, dia: paraDia(v.data), descricao: v.descricao, valor: Number(v.valor), recebidoEm: v.recebidoEm ? paraDia(v.recebidoEm) : null, recebimento: v.recebimento, obs: v.obs })),
          despesas: despesas.map((x) => ({ id: x.id, descricao: x.descricao, categoriaId: x.categoriaId, subcategoria: x.subcategoria, valor: Number(x.valor), origem: x.origem, placa: x.placa, km: x.km })),
          resumo: resumo[0],
          caixaObs: caixa?.obs ?? "",
          sugestoes: {
            vales: distintos(recVales.map((v) => v.descricao)),
            fornecedores: distintos(recCompras.map((c) => c.fornecedor)),
            pagamentos: distintos(["Boleto", "Tag", "À vista", ...recCompras.map((c) => c.pagamento)]),
            despesas: distintos(recDespesas.map((x) => x.descricao)),
            subcats: distintos(recDespesas.map((x) => x.subcategoria)),
            placas: distintos(recDespesas.map((x) => x.placa)),
          },
        }}
      />
    </div>
  );
}
