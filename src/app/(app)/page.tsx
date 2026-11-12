import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { homeFor } from "@/lib/roles";

/** A raiz leva cada perfil à sua tela inicial: gestor ao painel, funcionário aos lançamentos. */
export default async function Page() {
  const ctx = await getContexto();
  redirect(homeFor(ctx.user.role));
}
