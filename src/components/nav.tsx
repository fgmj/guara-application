"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ itens }: { itens: { href: string; label: string }[] }) {
  const path = usePathname();
  return itens.map((m) => {
    const ativo = path === m.href || path.startsWith(`${m.href}/`);
    return (
      <Link
        key={m.href}
        href={m.href}
        aria-current={ativo ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-sm whitespace-nowrap ${ativo ? "bg-amber-100 font-semibold text-brand-dark" : "hover:bg-stone-100"}`}
      >
        {m.label}
      </Link>
    );
  });
}
