import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGestor, type Role } from "@/lib/roles";

export type Contexto = {
  user: { id: string; name: string; role: Role };
  gestor: boolean;
  /** Filiais que o usuário pode usar. */
  filiais: { id: string; nome: string }[];
};

export async function getContexto(): Promise<Contexto> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const gestor = isGestor(session.user.role);
  const filiais = await prisma.filial.findMany({
    where: gestor ? { ativo: true } : { ativo: true, usuarios: { some: { id: session.user.id } } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return {
    user: { id: session.user.id, name: session.user.name ?? "", role: session.user.role },
    gestor,
    filiais,
  };
}

export async function exigirGestor(): Promise<Contexto> {
  const ctx = await getContexto();
  if (!ctx.gestor) redirect("/lancar");
  return ctx;
}

/** Filial selecionada (cookie). `todas` só vale para o gestor, quando permitido pela tela. */
export async function filialAtual(ctx: Contexto, permitirTodas = false): Promise<string | null> {
  const c = (await cookies()).get("filial")?.value;
  if (c === "todas" && permitirTodas && ctx.gestor) return "todas";
  if (c && ctx.filiais.some((f) => f.id === c)) return c;
  if (permitirTodas && ctx.gestor && ctx.filiais.length > 1) return "todas";
  return ctx.filiais[0]?.id ?? null;
}

export function idsDaSelecao(ctx: Contexto, sel: string | null): string[] {
  if (sel === "todas") return ctx.filiais.map((f) => f.id);
  return sel ? [sel] : [];
}
