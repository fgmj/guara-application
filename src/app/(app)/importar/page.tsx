import { exigirGestor } from "@/lib/contexto";
import { Bloco, Titulo } from "@/components/relatorio";
import { FormImportar } from "./form";

export const metadata = { title: "Importar planilha · Guará" };

export default async function Page() {
  const ctx = await exigirGestor();
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <Titulo>Importar planilha</Titulo>
      <Bloco titulo="Trazer o histórico da planilha de controle">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-stone-600">
          <li>No Google Planilhas, abra a planilha da filial.</li>
          <li>Clique em <b>Arquivo → Fazer download → Microsoft Excel (.xlsx)</b>.</li>
          <li>Escolha aqui a filial e o arquivo baixado.</li>
        </ol>
        <p className="mb-4 text-xs text-stone-500">São lidas as abas de digitação: Vendas, Compras, Vales, Despesas, Caixa e a posição de estoque. Resumos, relatórios e tabelas dinâmicas não são importados: o sistema recalcula tudo. Produtos, categorias, entregadores e formas de recebimento que não existirem são criados.</p>
        <FormImportar filiais={ctx.filiais} />
      </Bloco>
    </div>
  );
}
