import Link from "next/link";
import { signOut } from "@/auth";
import { getContexto } from "@/lib/contexto";
import { modulesFor, ROLE_LABELS } from "@/lib/roles";
import { NavLinks } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getContexto();
  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-stone-200 bg-white md:sticky md:top-0 md:h-dvh md:w-52 md:shrink-0 md:border-r md:border-b-0 print:hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1 md:block md:pt-5">
          <Link href="/" className="text-xl font-bold text-brand">Guará</Link>
          <p className="text-xs text-stone-500 md:mt-1">{user.name} · {ROLE_LABELS[user.role]}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pt-3">
          <NavLinks itens={modulesFor(user.role).map((m) => ({ href: m.href, label: m.label }))} />
          <Link href="/conta" className="rounded-md px-3 py-2 text-sm whitespace-nowrap text-stone-500 hover:bg-stone-100">Minha senha</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm whitespace-nowrap text-stone-500 hover:bg-stone-100">Sair</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-3 md:p-6">{children}</main>
    </div>
  );
}
