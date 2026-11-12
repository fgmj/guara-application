import { notFound } from "next/navigation";
import { MODULES } from "@/lib/roles";

// Página provisória: cada módulo ganhará sua própria rota nas próximas etapas.
export default async function ModuloPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const mod = MODULES.find((m) => m.href === `/${modulo}`);
  if (!mod) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">{mod.label}</h1>
      <p className="mt-2 text-stone-500">{mod.description} — em construção.</p>
    </div>
  );
}
