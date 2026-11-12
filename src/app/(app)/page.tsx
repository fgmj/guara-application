import Link from "next/link";
import { auth } from "@/auth";
import { modulesFor } from "@/lib/roles";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ negado?: string }>;
}) {
  const session = await auth();
  const { negado } = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Olá, {session?.user.name?.split(" ")[0]}</h1>
      {negado && (
        <p role="alert" className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Seu perfil não tem acesso a essa área.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulesFor(session?.user.role).map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-stone-200 bg-white p-5 hover:border-brand"
          >
            <h2 className="font-semibold">{m.label}</h2>
            <p className="text-sm text-stone-500">{m.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
