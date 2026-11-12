export const ROLES = ["ADMIN", "ATENDENTE", "ENTREGADOR", "FINANCEIRO"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  ATENDENTE: "Atendente",
  ENTREGADOR: "Entregador",
  FINANCEIRO: "Financeiro",
};

export type AppModule = {
  href: string;
  label: string;
  description: string;
  roles: readonly Role[];
};

/** Módulos do sistema e quais perfis podem acessá-los. ADMIN acessa tudo. */
export const MODULES: readonly AppModule[] = [
  {
    href: "/clientes",
    label: "Clientes",
    description: "Cadastro, endereços e histórico de compras",
    roles: ["ATENDENTE", "FINANCEIRO"],
  },
  {
    href: "/estoque",
    label: "Estoque",
    description: "Produtos, vasilhames e movimentações",
    roles: ["ATENDENTE"],
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    description: "Novos pedidos e acompanhamento",
    roles: ["ATENDENTE"],
  },
  {
    href: "/entregas",
    label: "Entregas",
    description: "Rota e status das entregas",
    roles: ["ATENDENTE", "ENTREGADOR"],
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    description: "Contas a receber, a pagar e fechamento",
    roles: ["FINANCEIRO"],
  },
];

export function canAccessModule(role: Role | undefined, mod: AppModule): boolean {
  if (!role) return false;
  return role === "ADMIN" || mod.roles.includes(role);
}

/** Verifica se o perfil pode acessar o caminho. Rotas fora de módulos são liberadas a qualquer usuário logado. */
export function canAccessPath(role: Role | undefined, pathname: string): boolean {
  if (!role) return false;
  const mod = MODULES.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
  return mod ? canAccessModule(role, mod) : true;
}

export function modulesFor(role: Role | undefined): AppModule[] {
  return MODULES.filter((m) => canAccessModule(role, m));
}
