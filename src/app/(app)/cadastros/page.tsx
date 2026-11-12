import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirGestor, filialAtual } from "@/lib/contexto";
import { ROLE_LABELS } from "@/lib/roles";
import { Titulo } from "@/components/relatorio";
import { FilialSelect } from "@/components/ui";
import { botaoCls, botaoSecCls, inputCls } from "@/components/estilos";
import { salvarCadastro } from "./actions";

export const metadata = { title: "Cadastros · Guará" };

const TIPOS = [
  ["filiais", "Filiais"], ["usuarios", "Usuários"], ["entregadores", "Entregadores"], ["formas", "Formas de recebimento"],
  ["produtos", "Produtos"], ["categorias", "Categorias de venda"], ["despesas", "Categorias de despesa"],
] as const;

type Campo =
  | { k: string; rotulo: string; tipo?: "texto" | "numero" | "senha"; largura?: string; dica?: string }
  | { k: string; rotulo: string; tipo: "opcao"; opcoes: [string, string][] }
  | { k: string; rotulo: string; tipo: "sim" }
  | { k: string; rotulo: string; tipo: "varios"; opcoes: [string, string][] };

type Reg = Record<string, unknown> & { id: string; ativo: boolean };

function Form({ tipo, campos, reg, filialId }: { tipo: string; campos: Campo[]; reg?: Reg; filialId?: string }) {
  const v = (k: string) => (reg?.[k] ?? "") as string;
  const i = `${inputCls} h-9 text-sm`;
  return (
    <form action={salvarCadastro} className="flex flex-wrap items-end gap-2 border-t border-stone-100 py-2 first:border-0">
      <input type="hidden" name="tipo" value={tipo} />
      {reg && <input type="hidden" name="id" value={reg.id} />}
      {filialId && <input type="hidden" name="filialId" value={filialId} />}
      {campos.map((c) =>
        c.tipo === "varios" ? (
          <fieldset key={c.k} className="text-xs text-stone-500">
            <legend>{c.rotulo}</legend>
            <span className="flex h-9 items-center gap-3">
              {c.opcoes.map(([id, nome]) => (
                <label key={id} className="flex items-center gap-1 whitespace-nowrap">
                  <input type="checkbox" name={c.k} value={id} defaultChecked={(reg?.[c.k] as string[] | undefined)?.includes(id)} />
                  {nome}
                </label>
              ))}
            </span>
          </fieldset>
        ) : (
          <label key={c.k} className={`text-xs text-stone-500 ${c.tipo === "sim" ? "flex h-9 items-center gap-1" : ("largura" in c && c.largura) || "w-28"}`}>
            {c.tipo === "sim" ? (
              <><input type="checkbox" name={c.k} defaultChecked={reg ? !!reg[c.k] : true} /> {c.rotulo}</>
            ) : c.tipo === "opcao" ? (
              <><span className="block">{c.rotulo}</span><select name={c.k} defaultValue={v(c.k)} className={i}>{c.opcoes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></>
            ) : (
              <><span className="block">{c.rotulo}</span><input name={c.k} type={c.tipo === "senha" ? "password" : "text"} inputMode={c.tipo === "numero" ? "decimal" : undefined} autoComplete={c.tipo === "senha" ? "new-password" : "off"} defaultValue={c.tipo === "senha" ? "" : v(c.k)} placeholder={c.dica} className={i} /></>
            )}
          </label>
        ),
      )}
      {reg && <label className="flex h-9 items-center gap-1 text-xs text-stone-500"><input type="checkbox" name="ativo" defaultChecked={reg.ativo} /> Ativo</label>}
      <button className={`${reg ? botaoSecCls : botaoCls} h-9`}>{reg ? "Salvar" : "Adicionar"}</button>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; erro?: string }> }) {
  const ctx = await exigirGestor();
  const { t, erro } = await searchParams;
  const tipo = TIPOS.find(([id]) => id === t)?.[0] ?? "filiais";
  const porFilial = tipo === "entregadores" || tipo === "formas";
  const filialId = (await filialAtual(ctx)) ?? "";
  let campos: Campo[] = [{ k: "nome", rotulo: "Nome", largura: "w-44" }];
  let regs: Reg[] = [];
  let nota = "";

  if (tipo === "filiais") {
    regs = await prisma.filial.findMany({ orderBy: { nome: "asc" } });
    nota = "Depois de criar uma filial, cadastre os entregadores e as formas de recebimento dela e libere os usuários.";
  } else if (tipo === "entregadores") {
    regs = await prisma.entregador.findMany({ where: { filialId }, orderBy: { nome: "asc" } });
  } else if (tipo === "formas") {
    regs = await prisma.formaRecebimento.findMany({ where: { filialId }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    campos.push({ k: "grupo", rotulo: "Tipo", tipo: "opcao", opcoes: [["CARTAO", "Cartão"], ["DINHEIRO", "Dinheiro"], ["PIX", "Pix"], ["OUTRO", "Outro"]] }, { k: "ordem", rotulo: "Ordem", tipo: "numero", largura: "w-16" });
    nota = "São os campos que o funcionário preenche ao fechar o caixa (uma maquininha por linha, dinheiro, Pix...).";
  } else if (tipo === "produtos") {
    const ps = await prisma.produto.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    regs = ps.map((p) => ({ ...p, custo: String(p.custo).replace(".", ","), baseId: p.baseId ?? "" }));
    campos.push(
      { k: "tipo", rotulo: "Tipo", tipo: "opcao", opcoes: [["GAS", "Botijão cheio"], ["VASILHAME", "Vasilhame"], ["OUTRO", "Outro (sem estoque)"]] },
      { k: "baseId", rotulo: "Vasilhame de", tipo: "opcao", opcoes: [["", "—"], ...ps.filter((p) => p.tipo === "GAS").map((p) => [p.id, p.nome] as [string, string])] },
      { k: "custo", rotulo: "Custo (R$)", tipo: "numero", largura: "w-24" },
      { k: "precos", rotulo: "Preços sugeridos", largura: "w-48", dica: "120 125 130" },
      { k: "ordem", rotulo: "Ordem", tipo: "numero", largura: "w-16" },
    );
    nota = "O custo é usado no resultado (margem) e como valor sugerido da compra. Os preços sugeridos viram botões na tela de venda.";
  } else if (tipo === "categorias") {
    regs = await prisma.categoriaVenda.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    campos.push({ k: "contaReceita", rotulo: "Conta como venda", tipo: "sim" }, { k: "ordem", rotulo: "Ordem", tipo: "numero", largura: "w-16" });
    nota = "Desmarque “Conta como venda” para trocas, transferências e empréstimos: mexem no estoque mas não entram no preço médio nem no resultado.";
  } else if (tipo === "despesas") {
    regs = await prisma.categoriaDespesa.findMany({ orderBy: { nome: "asc" } });
  } else {
    const us = await prisma.user.findMany({ orderBy: { name: "asc" }, include: { filiais: { select: { id: true } } } });
    const todas = await prisma.filial.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
    regs = us.map((u) => ({ id: u.id, ativo: u.active, nome: u.name, email: u.email, role: u.role, filiais: u.filiais.map((f) => f.id) }));
    campos = [
      { k: "nome", rotulo: "Nome", largura: "w-36" }, { k: "email", rotulo: "E-mail (login)", largura: "w-48" },
      { k: "role", rotulo: "Perfil", tipo: "opcao", opcoes: (["FUNCIONARIO", "GESTOR", "ADMIN"] as const).map((r) => [r, ROLE_LABELS[r]]) },
      { k: "filiais", rotulo: "Filiais (funcionário)", tipo: "varios", opcoes: todas.map((f) => [f.id, f.nome]) },
      { k: "senha", rotulo: "Senha", tipo: "senha", largura: "w-32", dica: "manter" },
    ];
    nota = "Funcionário só lança (vendas, compras, vales, despesas e caixa) nas filiais marcadas. Gestor vê tudo, de todas as filiais.";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Titulo extra={porFilial ? <FilialSelect filiais={ctx.filiais} atual={filialId} todas={false} /> : null}>Cadastros</Titulo>
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200/70 p-1">
        {TIPOS.map(([id, nome]) => (
          <Link key={id} href={`/cadastros?t=${id}`} aria-current={id === tipo ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${id === tipo ? "bg-white text-brand-dark shadow-sm" : "text-stone-600"}`}>{nome}</Link>
        ))}
      </nav>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <section className="rounded-xl border border-stone-200 bg-white p-3 md:p-4">
        {nota && <p className="mb-2 text-xs text-stone-500">{nota}</p>}
        <h2 className="text-sm font-semibold text-stone-700">Novo</h2>
        <Form key={`novo-${tipo}-${regs.length}`} tipo={tipo} campos={campos} filialId={porFilial ? filialId : undefined} />
        <h2 className="mt-4 text-sm font-semibold text-stone-700">Cadastrados</h2>
        {regs.length === 0 && <p className="text-sm text-stone-500">Nenhum cadastro.</p>}
        {regs.map((r) => <Form key={r.id} tipo={tipo} campos={campos} reg={r} filialId={porFilial ? filialId : undefined} />)}
      </section>
    </div>
  );
}
