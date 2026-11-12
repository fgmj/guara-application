"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Campo, Chips, botaoCls, botaoSecCls, inputCls } from "@/components/ui";
import { fmtDia, fmtDiaCurto, somaDias } from "@/lib/datas";
import { brl, parseValor } from "@/lib/dinheiro";
import { SITUACAO_TEXTO, TOLERANCIA } from "@/lib/caixa";
import type { DiaResumo, ProdutoInfo } from "@/lib/resumo";
import { addCompra, addDespesa, addVale, addVenda, excluir, reabrirCaixa, receberVale, salvarCaixa, type Resultado } from "./actions";

type Item = { id: string; nome: string };
export type Dados = {
  filialId: string;
  dia: string;
  hoje: string;
  gestor: boolean;
  fechado: boolean;
  podeEditar: boolean;
  diasAtras: number;
  produtos: ProdutoInfo[];
  categorias: Item[];
  entregadores: Item[];
  formas: Item[];
  catsDespesa: Item[];
  vendas: { id: string; categoriaId: string; entregadorId: string | null; produtoId: string; quantidade: number; valorUnit: number; total: number }[];
  compras: { id: string; produtoId: string; quantidade: number; valor: number; fornecedor: string | null; pagamento: string | null; nota: string | null }[];
  vales: { id: string; dia: string; descricao: string; valor: number; recebidoEm: string | null; recebimento: string | null; obs: string | null }[];
  despesas: { id: string; descricao: string; categoriaId: string; subcategoria: string | null; valor: number; origem: "CAIXA" | "CARTAO" | "CONTA"; placa: string | null; km: number | null }[];
  resumo: DiaResumo;
  caixaObs: string;
  sugestoes: Record<"vales" | "fornecedores" | "pagamentos" | "despesas" | "subcats" | "placas", string[]>;
};

const ABAS = [
  { id: "vendas", nome: "Vendas" },
  { id: "compras", nome: "Compras" },
  { id: "vales", nome: "Vales" },
  { id: "despesas", nome: "Despesas" },
  { id: "caixa", nome: "Caixa" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const ORIGENS = [
  { id: "CAIXA" as const, nome: "Caixa (dinheiro)" },
  { id: "CARTAO" as const, nome: "Cartão" },
  { id: "CONTA" as const, nome: "Conta-corrente" },
];

/** Envia uma ação, mostra o erro e atualiza os dados da tela. */
function useEnvio() {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState("");
  const enviar = (acao: () => Promise<Resultado>, depois?: () => void) =>
    start(async () => {
      const r = await acao();
      if ("erro" in r) return setErro(r.erro);
      setErro("");
      depois?.();
      router.refresh();
    });
  return { pendente, erro, enviar };
}

function Erro({ msg }: { msg: string }) {
  return msg ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null;
}

function Sugestoes({ id, itens }: { id: string; itens: string[] }) {
  return <datalist id={id}>{itens.map((s) => <option key={s} value={s} />)}</datalist>;
}

function Excluir({ d, tipo, id }: { d: Dados; tipo: "venda" | "compra" | "vale" | "despesa"; id: string }) {
  const { pendente, enviar } = useEnvio();
  if (!d.podeEditar) return null;
  return (
    <button
      type="button"
      aria-label="Excluir lançamento"
      disabled={pendente}
      onClick={() => confirm("Excluir este lançamento?") && enviar(() => excluir(tipo, id))}
      className="size-8 shrink-0 rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600"
    >
      ✕
    </button>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-2 border-b border-stone-100 py-1.5 text-sm last:border-0">{children}</li>;
}

function Cartao({ titulo, children, extra }: { titulo?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-3 md:p-4">
      {titulo && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-stone-700">{titulo}</h2>
          <span className="text-sm text-stone-500 tabular-nums">{extra}</span>
        </div>
      )}
      {children}
    </section>
  );
}

function useLembrar<T>(chave: string, inicial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(inicial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(chave);
      if (s) setV(JSON.parse(s));
    } catch {}
  }, [chave]);
  return [v, (n: T) => { setV(n); try { localStorage.setItem(chave, JSON.stringify(n)); } catch {} }];
}

/* ---------------------------------- Vendas --------------------------------- */

function Vendas({ d }: { d: Dados }) {
  const { pendente, erro, enviar } = useEnvio();
  const [sel, setSel] = useLembrar(`venda-${d.filialId}`, { entregadorId: "", categoriaId: "", produtoId: "" });
  const nome = (xs: Item[], id: string | null) => xs.find((x) => x.id === id)?.nome ?? "—";
  const entregadorId = d.entregadores.some((e) => e.id === sel.entregadorId) ? sel.entregadorId : "";
  const categoriaId = d.categorias.some((c) => c.id === sel.categoriaId) ? sel.categoriaId : (d.categorias[0]?.id ?? "");
  const produto = d.produtos.find((p) => p.id === sel.produtoId) ?? d.produtos[0];
  const [qtd, setQtd] = useState("");
  const [preco, setPreco] = useState("");
  const qtdRef = useRef<HTMLInputElement>(null);

  // preços sugeridos: cadastro do produto + preços já usados hoje
  const precos = useMemo(() => {
    const usados = d.vendas.filter((v) => v.produtoId === produto?.id).map((v) => v.valorUnit);
    return [...new Set([...(produto?.precos ?? []), ...usados])].sort((a, b) => a - b).slice(0, 10);
  }, [d.vendas, produto]);

  const total = (Number(qtd) || 0) * (parseValor(preco) || 0);
  const grupos = useMemo(() => {
    const m = new Map<string, Dados["vendas"]>();
    for (const v of d.vendas) m.set(v.entregadorId ?? "", [...(m.get(v.entregadorId ?? "") ?? []), v]);
    return [...m.entries()];
  }, [d.vendas]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!produto) return;
    enviar(
      () => addVenda({ filialId: d.filialId, dia: d.dia, categoriaId, entregadorId: entregadorId || null, produtoId: produto.id, quantidade: qtd, valorUnit: preco }),
      () => { setQtd(""); qtdRef.current?.focus(); },
    );
  }

  return (
    <div className="space-y-3">
      {d.podeEditar && (
        <Cartao>
          <form onSubmit={salvar} className="space-y-3">
            {d.entregadores.length > 0 && (
              <Chips rotulo="Entregador" opcoes={d.entregadores} valor={entregadorId || null} onChange={(v) => setSel({ ...sel, entregadorId: v })} />
            )}
            <Chips rotulo="Categoria" opcoes={d.categorias} valor={categoriaId} onChange={(v) => setSel({ ...sel, categoriaId: v })} />
            <Chips rotulo="Produto" opcoes={d.produtos} valor={produto?.id ?? null} onChange={(v) => { setSel({ ...sel, produtoId: v }); setPreco(""); }} />
            <div className="flex flex-wrap items-end gap-2">
              <Campo rotulo="Quantidade" className="w-24">
                <input ref={qtdRef} autoFocus inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} className={`${inputCls} text-center text-lg font-semibold`} />
              </Campo>
              <Campo rotulo="Preço unitário" className="w-32">
                <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" className={`${inputCls} text-lg font-semibold`} />
              </Campo>
              <button disabled={pendente || !qtd || !preco} className={`${botaoCls} flex-1 text-base`}>
                {total > 0 ? `Lançar ${brl(total)}` : "Lançar venda"}
              </button>
            </div>
            {precos.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Preços sugeridos">
                {precos.map((p) => (
                  <button key={p} type="button" onClick={() => { setPreco(String(p).replace(".", ",")); if (!qtd) qtdRef.current?.focus(); }}
                    className={`h-9 rounded-lg border px-3 text-sm tabular-nums ${parseValor(preco) === p ? "border-brand bg-amber-50 font-semibold text-brand-dark" : "border-stone-200 bg-stone-50 text-stone-600 hover:border-brand"}`}>
                    {brl(p)}
                  </button>
                ))}
              </div>
            )}
            <Erro msg={erro} />
          </form>
        </Cartao>
      )}
      {grupos.length === 0 && <p className="px-1 text-sm text-stone-500">Nenhuma venda lançada neste dia.</p>}
      {grupos.map(([eid, vs]) => (
        <Cartao key={eid} titulo={eid ? nome(d.entregadores, eid) : "Sem entregador"} extra={`${vs.reduce((s, v) => s + v.quantidade, 0)} un · ${brl(vs.reduce((s, v) => s + v.total, 0))}`}>
          <ul>
            {vs.map((v) => (
              <Linha key={v.id}>
                <span className="w-8 text-right font-semibold tabular-nums">{v.quantidade}</span>
                <span className="min-w-0 flex-1 truncate">
                  {nome(d.produtos, v.produtoId)} <span className="text-stone-400">· {nome(d.categorias, v.categoriaId)} · {brl(v.valorUnit)}</span>
                </span>
                <span className="font-medium tabular-nums">{brl(v.total)}</span>
                <Excluir d={d} tipo="venda" id={v.id} />
              </Linha>
            ))}
          </ul>
        </Cartao>
      ))}
    </div>
  );
}

/* --------------------------------- Compras --------------------------------- */

function Compras({ d }: { d: Dados }) {
  const { pendente, erro, enviar } = useEnvio();
  const estoque = d.produtos.filter((p) => p.tipo !== "OUTRO");
  const [produtoId, setProdutoId] = useState(estoque[0]?.id ?? "");
  const produto = d.produtos.find((p) => p.id === produtoId);
  const [qtd, setQtd] = useState("");
  const [valor, setValor] = useState("");
  const [f, setF] = useLembrar(`compra-${d.filialId}`, { fornecedor: "", pagamento: "Boleto" });
  const [nota, setNota] = useState("");
  const [venc, setVenc] = useState(somaDias(d.dia, 7));
  const sugerido = produto && qtd ? (Number(qtd) * produto.custo).toFixed(2).replace(".", ",") : "";

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    enviar(
      () => addCompra({ filialId: d.filialId, dia: d.dia, produtoId, quantidade: qtd, valor: valor || sugerido || "0", fornecedor: f.fornecedor, pagamento: f.pagamento, vencimento: venc, nota }),
      () => { setQtd(""); setValor(""); setNota(""); },
    );
  }

  return (
    <div className="space-y-3">
      {d.podeEditar && (
        <Cartao>
          <form onSubmit={salvar} className="space-y-3">
            <Chips rotulo="Produto" opcoes={estoque} valor={produtoId} onChange={setProdutoId} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Campo rotulo="Quantidade">
                <input autoFocus inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} className={`${inputCls} text-center text-lg font-semibold`} />
              </Campo>
              <Campo rotulo="Valor total">
                <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={sugerido || "0,00"} className={inputCls} />
              </Campo>
              <Campo rotulo="Pagamento">
                <input list="sug-pag" value={f.pagamento} onChange={(e) => setF({ ...f, pagamento: e.target.value })} className={inputCls} />
              </Campo>
              <Campo rotulo="Vencimento">
                <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className={inputCls} />
              </Campo>
              <Campo rotulo="Fornecedor" className="col-span-2">
                <input list="sug-forn" value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} className={inputCls} />
              </Campo>
              <Campo rotulo="Nº da nota" className="col-span-2">
                <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
              </Campo>
            </div>
            <Sugestoes id="sug-pag" itens={d.sugestoes.pagamentos} />
            <Sugestoes id="sug-forn" itens={d.sugestoes.fornecedores} />
            <button disabled={pendente || !qtd} className={`${botaoCls} w-full`}>Lançar compra</button>
            <Erro msg={erro} />
          </form>
        </Cartao>
      )}
      <Cartao titulo="Compras do dia" extra={brl(d.compras.reduce((s, c) => s + c.valor, 0))}>
        {d.compras.length === 0 && <p className="text-sm text-stone-500">Nenhuma compra neste dia.</p>}
        <ul>
          {d.compras.map((c) => (
            <Linha key={c.id}>
              <span className="w-8 text-right font-semibold tabular-nums">{c.quantidade}</span>
              <span className="min-w-0 flex-1 truncate">
                {d.produtos.find((p) => p.id === c.produtoId)?.nome}
                <span className="text-stone-400"> {[c.fornecedor, c.pagamento, c.nota && `NF ${c.nota}`].filter(Boolean).map((x) => `· ${x}`).join(" ")}</span>
              </span>
              <span className="font-medium tabular-nums">{brl(c.valor)}</span>
              <Excluir d={d} tipo="compra" id={c.id} />
            </Linha>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

/* ---------------------------------- Vales ---------------------------------- */

function Vales({ d }: { d: Dados }) {
  const { pendente, erro, enviar } = useEnvio();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const doDia = d.vales.filter((v) => v.dia === d.dia);
  const pendentes = d.vales.filter((v) => !v.recebidoEm && v.dia !== d.dia);
  const recebidos = d.vales.filter((v) => v.recebidoEm === d.dia);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    enviar(() => addVale({ filialId: d.filialId, dia: d.dia, descricao, valor }), () => { setDescricao(""); setValor(""); });
  }
  const receber = (id: string, como: "CAIXA" | "CONTA" | "DESCONTO" | null) => enviar(() => receberVale(id, d.dia, como));

  const Receber = ({ id }: { id: string }) =>
    d.podeEditar ? (
      <span className="flex shrink-0 gap-1">
        <button type="button" disabled={pendente} onClick={() => receber(id, "CAIXA")} className="h-8 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700">Recebi no caixa</button>
        <select aria-label="Outra forma de recebimento" value="" disabled={pendente} onChange={(e) => e.target.value && receber(id, e.target.value as "CONTA" | "DESCONTO")} className="h-8 w-8 rounded-lg border border-stone-300 bg-white text-xs">
          <option value="">⋯</option>
          <option value="CONTA">Recebido na conta (Pix/transferência)</option>
          <option value="DESCONTO">Descontado do pagamento</option>
        </select>
      </span>
    ) : null;

  return (
    <div className="space-y-3">
      {d.podeEditar && (
        <Cartao>
          <form onSubmit={salvar} className="flex flex-wrap items-end gap-2">
            <Campo rotulo="Cliente ou funcionário" className="min-w-40 flex-1">
              <input autoFocus list="sug-vale" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inputCls} />
            </Campo>
            <Campo rotulo="Valor" className="w-28">
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputCls} />
            </Campo>
            <button disabled={pendente || !descricao || !valor} className={botaoCls}>Lançar vale</button>
            <Sugestoes id="sug-vale" itens={d.sugestoes.vales} />
          </form>
          <p className="mt-2 text-xs text-stone-500">Vale é venda fiada ou adiantamento: sai do caixa hoje e volta quando for recebido.</p>
        </Cartao>
      )}
      <Erro msg={erro} />
      <Cartao titulo="Vales lançados no dia" extra={brl(doDia.reduce((s, v) => s + v.valor, 0))}>
        {doDia.length === 0 && <p className="text-sm text-stone-500">Nenhum vale neste dia.</p>}
        <ul>
          {doDia.map((v) => (
            <Linha key={v.id}>
              <span className="min-w-0 flex-1 truncate">{v.descricao}{v.recebidoEm && <span className="text-emerald-700"> · recebido</span>}</span>
              <span className="font-medium tabular-nums">{brl(v.valor)}</span>
              {!v.recebidoEm && <Receber id={v.id} />}
              <Excluir d={d} tipo="vale" id={v.id} />
            </Linha>
          ))}
        </ul>
      </Cartao>
      {recebidos.length > 0 && (
        <Cartao titulo="Recebidos neste dia" extra={brl(recebidos.reduce((s, v) => s + v.valor, 0))}>
          <ul>
            {recebidos.map((v) => (
              <Linha key={v.id}>
                <span className="min-w-0 flex-1 truncate">{v.descricao} <span className="text-stone-400">· de {fmtDia(v.dia)} · {v.recebimento === "CAIXA" ? "no caixa" : v.recebimento === "CONTA" ? "na conta" : "desconto"}</span></span>
                <span className="font-medium tabular-nums">{brl(v.valor)}</span>
                {d.podeEditar && <button type="button" disabled={pendente} onClick={() => receber(v.id, null)} className="text-xs text-stone-500 underline">desfazer</button>}
              </Linha>
            ))}
          </ul>
        </Cartao>
      )}
      <Cartao titulo="A receber (dias anteriores)" extra={brl(pendentes.reduce((s, v) => s + v.valor, 0))}>
        {pendentes.length === 0 && <p className="text-sm text-stone-500">Nenhum vale pendente.</p>}
        <ul>
          {pendentes.map((v) => (
            <Linha key={v.id}>
              <span className="min-w-0 flex-1 truncate">{v.descricao} <span className="text-stone-400">· {fmtDia(v.dia)}</span></span>
              <span className="font-medium tabular-nums">{brl(v.valor)}</span>
              <Receber id={v.id} />
            </Linha>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

/* --------------------------------- Despesas -------------------------------- */

function Despesas({ d }: { d: Dados }) {
  const { pendente, erro, enviar } = useEnvio();
  const [f, setF] = useState({ descricao: "", valor: "", subcategoria: "", placa: "", km: "" });
  const [categoriaId, setCategoriaId] = useState("");
  const [origem, setOrigem] = useState<"CAIXA" | "CARTAO" | "CONTA">("CAIXA");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const veiculo = /carro|moto|ve[ií]culo/i.test(d.catsDespesa.find((c) => c.id === categoriaId)?.nome ?? "");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    enviar(
      () => addDespesa({ filialId: d.filialId, dia: d.dia, categoriaId, origem, ...f, placa: veiculo ? f.placa : "", km: veiculo ? f.km : "" }),
      () => setF({ descricao: "", valor: "", subcategoria: "", placa: f.placa, km: "" }),
    );
  }

  return (
    <div className="space-y-3">
      {d.podeEditar && (
        <Cartao>
          <form onSubmit={salvar} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Campo rotulo="Descrição" className="min-w-40 flex-1">
                <input autoFocus list="sug-desp" value={f.descricao} onChange={set("descricao")} className={inputCls} />
              </Campo>
              <Campo rotulo="Valor" className="w-28">
                <input inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="0,00" className={inputCls} />
              </Campo>
            </div>
            <Chips rotulo="Categoria" opcoes={d.catsDespesa} valor={categoriaId || null} onChange={setCategoriaId} />
            <Chips rotulo="Pago com" opcoes={ORIGENS} valor={origem} onChange={setOrigem} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Campo rotulo="Subcategoria (opcional)">
                <input list="sug-sub" value={f.subcategoria} onChange={set("subcategoria")} className={inputCls} />
              </Campo>
              {veiculo && (
                <>
                  <Campo rotulo="Placa"><input list="sug-placa" value={f.placa} onChange={set("placa")} className={inputCls} /></Campo>
                  <Campo rotulo="KM"><input inputMode="numeric" value={f.km} onChange={set("km")} className={inputCls} /></Campo>
                </>
              )}
            </div>
            <Sugestoes id="sug-desp" itens={d.sugestoes.despesas} />
            <Sugestoes id="sug-sub" itens={d.sugestoes.subcats} />
            <Sugestoes id="sug-placa" itens={d.sugestoes.placas} />
            <button disabled={pendente || !f.descricao || !f.valor || !categoriaId} className={`${botaoCls} w-full`}>Lançar despesa</button>
            <Erro msg={erro} />
          </form>
        </Cartao>
      )}
      <Cartao titulo="Despesas do dia" extra={brl(d.despesas.reduce((s, x) => s + x.valor, 0))}>
        {d.despesas.length === 0 && <p className="text-sm text-stone-500">Nenhuma despesa neste dia.</p>}
        <ul>
          {d.despesas.map((x) => (
            <Linha key={x.id}>
              <span className="min-w-0 flex-1 truncate">
                {x.descricao}
                <span className="text-stone-400"> · {d.catsDespesa.find((c) => c.id === x.categoriaId)?.nome}{x.subcategoria ? ` / ${x.subcategoria}` : ""} · {ORIGENS.find((o) => o.id === x.origem)?.nome}{x.placa ? ` · ${x.placa}` : ""}</span>
              </span>
              <span className="font-medium tabular-nums">{brl(x.valor)}</span>
              <Excluir d={d} tipo="despesa" id={x.id} />
            </Linha>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

/* ---------------------------------- Caixa ---------------------------------- */

function Caixa({ d }: { d: Dados }) {
  const { pendente, erro, enviar } = useEnvio();
  const r = d.resumo;
  const [itens, setItens] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.formas.map((f) => [f.id, r.formas[f.id] ? String(r.formas[f.id]).replace(".", ",") : ""])),
  );
  const [obs, setObs] = useState(d.caixaObs);
  const informado = d.formas.reduce((s, f) => s + (parseValor(itens[f.id]) || 0), 0);
  const caixa = informado + r.valesEmitidos + r.despesasCaixa;
  const dif = r.esperado - caixa;
  const situacao = Math.abs(dif) <= TOLERANCIA ? "ok" : dif > 0 ? "falta" : "sobra";
  const gas = d.produtos.filter((p) => p.tipo === "GAS");
  const salvar = (fechar: boolean) => enviar(() => salvarCaixa({ filialId: d.filialId, dia: d.dia, itens, fechar, obs }));

  const porCategoria = d.categorias
    .map((c) => {
      const vs = d.vendas.filter((v) => v.categoriaId === c.id);
      return { nome: c.nome, qtd: vs.reduce((s, v) => s + v.quantidade, 0), total: vs.reduce((s, v) => s + v.total, 0) };
    })
    .filter((x) => x.qtd > 0);

  return (
    <div className="space-y-3">
      {d.fechado && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>Caixa fechado.</span>
          {d.gestor && <button type="button" disabled={pendente} onClick={() => enviar(() => reabrirCaixa(d.filialId, d.dia))} className="font-semibold underline">Reabrir</button>}
        </div>
      )}
      <Cartao titulo="Vendas do dia" extra={brl(r.vendaTotal)}>
        {porCategoria.length === 0 && <p className="text-sm text-stone-500">Nenhuma venda lançada.</p>}
        <ul>
          {porCategoria.map((c) => (
            <Linha key={c.nome}>
              <span className="w-8 text-right font-semibold tabular-nums">{c.qtd}</span>
              <span className="flex-1">{c.nome}</span>
              <span className="tabular-nums">{brl(c.total)}</span>
            </Linha>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Contagem do estoque">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-stone-500">
            <tr><th className="text-left font-medium">Produto</th><th>Inicial</th><th>Entrada</th><th>Saída</th><th>Cheios</th><th>Vazios</th></tr>
          </thead>
          <tbody>
            {gas.map((p) => {
              const ent = r.comprados[p.id] ?? 0, sai = r.vendidos[p.id] ?? 0, fim = r.cheios[p.id] ?? 0;
              return (
                <tr key={p.id} className="border-t border-stone-100 text-center">
                  <td className="py-1 text-left font-medium">{p.nome}</td><td>{fim - ent + sai}</td><td>{ent}</td><td>{sai}</td>
                  <td className="font-semibold">{fim}</td><td>{Math.max(0, (r.cascos[p.id] ?? 0) - fim)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-500">Confira com a contagem física. Se não bater, avise o gestor.</p>
      </Cartao>
      <Cartao titulo="Fechamento do caixa">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {d.formas.map((f) => (
            <Campo key={f.id} rotulo={f.nome}>
              <input inputMode="decimal" disabled={!d.podeEditar} value={itens[f.id] ?? ""} onChange={(e) => setItens({ ...itens, [f.id]: e.target.value })} placeholder="0,00" className={inputCls} />
            </Campo>
          ))}
        </div>
        <dl className="mt-3 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between"><dt className="text-stone-500">Recebido (formas acima)</dt><dd>{brl(informado)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">+ Vales lançados hoje</dt><dd>{brl(r.valesEmitidos)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">+ Despesas pagas com o caixa</dt><dd>{brl(r.despesasCaixa)}</dd></div>
          <div className="flex justify-between border-t border-stone-200 pt-1 font-semibold"><dt>Total do caixa</dt><dd>{brl(caixa)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">Vendas {r.valesRecebidos > 0 && `+ vales recebidos (${brl(r.valesRecebidos)})`}</dt><dd>{brl(r.esperado)}</dd></div>
        </dl>
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${situacao === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {situacao === "ok" ? "Caixa batendo" : SITUACAO_TEXTO[situacao]}
          {Math.abs(dif) >= 0.01 && <span className="tabular-nums"> Diferença: {brl(Math.abs(dif))} {dif > 0 ? "a menos" : "a mais"} no caixa.</span>}
        </p>
        {d.podeEditar && (
          <>
            <Campo rotulo="Observação" className="mt-3"><input value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} /></Campo>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={pendente} onClick={() => salvar(false)} className={`${botaoSecCls} flex-1`}>Salvar</button>
              {!d.fechado && <button type="button" disabled={pendente} onClick={() => (situacao === "ok" || confirm("O caixa não está batendo. Fechar mesmo assim?")) && salvar(true)} className={`${botaoCls} flex-1`}>Fechar caixa</button>}
            </div>
          </>
        )}
        <Erro msg={erro} />
      </Cartao>
    </div>
  );
}

/* --------------------------------- Principal -------------------------------- */

export function Lancar({ d, seletor }: { d: Dados; seletor: React.ReactNode }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("vendas");
  const ir = (dia: string) => router.push(dia === d.hoje ? "/lancar" : `/lancar?d=${dia}`);
  const minimo = somaDias(d.hoje, -d.diasAtras);
  const principal = d.produtos.find((p) => p.tipo === "GAS");
  const contagem: Record<Aba, number> = { vendas: d.vendas.length, compras: d.compras.length, vales: d.vales.filter((v) => v.dia === d.dia).length, despesas: d.despesas.length, caixa: 0 };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        {seletor}
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Dia anterior" disabled={d.dia <= minimo} onClick={() => ir(somaDias(d.dia, -1))} className="size-9 rounded-lg border border-stone-300 bg-white disabled:opacity-30">‹</button>
          <label className="relative">
            <span className="flex h-9 items-center rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold">{d.dia === d.hoje ? "Hoje · " : ""}{fmtDiaCurto(d.dia)}</span>
            <input type="date" aria-label="Data" value={d.dia} min={d.diasAtras < 1000 ? minimo : undefined} max={d.hoje} onChange={(e) => e.target.value && ir(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <button type="button" aria-label="Próximo dia" disabled={d.dia >= d.hoje} onClick={() => ir(somaDias(d.dia, 1))} className="size-9 rounded-lg border border-stone-300 bg-white disabled:opacity-30">›</button>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200"><p className="text-xs text-stone-500">Vendido</p><p className="font-semibold tabular-nums">{brl(d.resumo.vendaTotal)}</p></div>
        <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200"><p className="text-xs text-stone-500">{principal?.nome ?? "Botijões"} vendidos</p><p className="font-semibold tabular-nums">{d.resumo.venda}</p></div>
        <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200"><p className="text-xs text-stone-500">{principal?.nome ?? "Botijões"} cheios</p><p className="font-semibold tabular-nums">{d.resumo.final}</p></div>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200/70 p-1">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`h-10 flex-1 rounded-lg px-2 text-sm font-medium whitespace-nowrap ${aba === a.id ? "bg-white text-brand-dark shadow-sm" : "text-stone-600"}`}>
            {a.nome}{contagem[a.id] > 0 && <span className="ml-1 text-xs text-stone-400">{contagem[a.id]}</span>}
          </button>
        ))}
      </div>
      {aba === "vendas" && <Vendas d={d} />}
      {aba === "compras" && <Compras d={d} />}
      {aba === "vales" && <Vales d={d} />}
      {aba === "despesas" && <Despesas d={d} />}
      {aba === "caixa" && <Caixa d={d} />}
    </div>
  );
}
