import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { modulesFor, ROLE_LABELS } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { user } = session;

  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-stone-200 bg-white md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <Link href="/" className="text-xl font-bold text-brand">
            Guará
          </Link>
          <p className="text-xs text-stone-500 md:mt-1">
            {user.name} · {ROLE_LABELS[user.role]}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {modulesFor(user.role).map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-stone-100"
            >
              {m.label}
            </Link>
          ))}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100">
              Sair
            </button>
          </form>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
