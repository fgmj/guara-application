export const ROLES = ["ADMIN", "GESTOR", "FUNCIONARIO"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  FUNCIONARIO: "Funcionário",
};

export type AppModule = { href: string; label: string; gestor: boolean };

/** Funcionário só lança; os consolidados e cadastros são do gestor. */
export const MODULES: readonly AppModule[] = [
  { href: "/painel", label: "Painel", gestor: true },
  { href: "/lancar", label: "Lançamentos", gestor: false },
  { href: "/dia", label: "Relatório do dia", gestor: false },
  { href: "/fechamento", label: "Fechamento", gestor: true },
  { href: "/relatorios", label: "Relatórios", gestor: true },
  { href: "/estoque", label: "Estoque", gestor: true },
  { href: "/vales", label: "Vales", gestor: true },
  { href: "/cadastros", label: "Cadastros", gestor: true },
  { href: "/importar", label: "Importar planilha", gestor: true },
];

export function isGestor(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "GESTOR";
}

export function homeFor(role: Role | undefined): string {
  return isGestor(role) ? "/painel" : "/lancar";
}

/** Funcionário acessa apenas /lancar, /dia e /conta; gestor acessa tudo. */
export function canAccessPath(role: Role | undefined, pathname: string): boolean {
  if (!role) return false;
  if (isGestor(role)) return true;
  return ["/lancar", "/dia", "/conta"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function modulesFor(role: Role | undefined): AppModule[] {
  return MODULES.filter((m) => isGestor(role) || !m.gestor);
}
