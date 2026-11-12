"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getContexto } from "@/lib/contexto";
import { parseValor } from "@/lib/dinheiro";

function voltar(tipo: string, msg?: string): never {
  revalidatePath("/", "layout");
  redirect(`/cadastros?t=${tipo}${msg ? `&erro=${encodeURIComponent(msg)}` : ""}`);
}

/** Cria (sem id) ou altera (com id) um cadastro. Somente gestor. */
export async function salvarCadastro(fd: FormData) {
  const ctx = await getContexto();
  const tipo = String(fd.get("tipo"));
  if (!ctx.gestor) redirect("/lancar");
  const id = String(fd.get("id") ?? "");
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const b = (k: string) => fd.get(k) === "on";
  const n = (k: string) => Math.trunc(Number(s(k))) || 0;
  const nome = s("nome");
  if (!nome) voltar(tipo, "Informe o nome.");
  const ativo = id ? b("ativo") : true;
  const gravar = async <D,>(m: { create: (a: { data: D }) => Promise<unknown>; update: (a: { where: { id: string }; data: D }) => Promise<unknown> }, data: D) =>
    id ? m.update({ where: { id }, data }) : m.create({ data });

  try {
    switch (tipo) {
      case "filiais":
        await gravar(prisma.filial as never, { nome, ativo });
        break;
      case "entregadores":
        await gravar(prisma.entregador as never, { nome, ativo, filialId: s("filialId") });
        break;
      case "formas":
        await gravar(prisma.formaRecebimento as never, { nome, ativo, filialId: s("filialId"), grupo: s("grupo") || "CARTAO", ordem: n("ordem") });
        break;
      case "produtos":
        await gravar(prisma.produto as never, { nome, ativo, tipo: s("tipo") || "GAS", baseId: s("tipo") === "VASILHAME" ? s("baseId") || null : null, custo: parseValor(s("custo")) || 0, precos: s("precos"), ordem: n("ordem") });
        break;
      case "categorias":
        await gravar(prisma.categoriaVenda as never, { nome, ativo, contaReceita: b("contaReceita"), ordem: n("ordem") });
        break;
      case "despesas":
        await gravar(prisma.categoriaDespesa as never, { nome, ativo });
        break;
      case "usuarios": {
        const email = s("email").toLowerCase();
        const senha = s("senha");
        const role = s("role") === "ADMIN" && ctx.user.role === "ADMIN" ? "ADMIN" : s("role") === "GESTOR" ? "GESTOR" : s("role") === "ADMIN" ? "GESTOR" : "FUNCIONARIO";
        const filiais = fd.getAll("filiais").map((f) => ({ id: String(f) }));
        if (!email.includes("@")) voltar(tipo, "Informe um e-mail válido.");
        if (senha && senha.length < 8) voltar(tipo, "A senha precisa ter pelo menos 8 caracteres.");
        if (id) {
          const alvo = await prisma.user.findUnique({ where: { id } });
          if (alvo?.role === "ADMIN" && ctx.user.role !== "ADMIN") voltar(tipo, "Só um administrador altera outro administrador.");
          if (id === ctx.user.id && (!ativo || role !== ctx.user.role)) voltar(tipo, "Você não pode rebaixar ou desativar o próprio usuário.");
          await prisma.user.update({ where: { id }, data: { name: nome, email, role, active: ativo, filiais: { set: filiais }, ...(senha ? { passwordHash: await bcrypt.hash(senha, 12) } : {}) } });
        } else {
          if (!senha) voltar(tipo, "Defina uma senha inicial.");
          await prisma.user.create({ data: { name: nome, email, role, passwordHash: await bcrypt.hash(senha, 12), filiais: { connect: filiais } } });
        }
        break;
      }
      default:
        voltar("filiais", "Cadastro desconhecido.");
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") voltar(tipo, `Já existe um cadastro com esse nome${tipo === "usuarios" ? " ou e-mail" : ""}.`);
    throw e;
  }
  voltar(tipo);
}

export async function trocarSenha(_: { msg: string; ok?: boolean }, fd: FormData) {
  const ctx = await getContexto();
  const atual = String(fd.get("atual") ?? ""), nova = String(fd.get("nova") ?? "");
  const u = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!u || !(await bcrypt.compare(atual, u.passwordHash))) return { msg: "Senha atual incorreta." };
  if (nova.length < 8) return { msg: "A nova senha precisa ter pelo menos 8 caracteres." };
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(nova, 12) } });
  return { msg: "Senha alterada.", ok: true };
}
