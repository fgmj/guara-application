import { describe, expect, it } from "vitest";
import { canAccessPath, modulesFor, MODULES } from "./roles";

describe("controle de acesso por perfil", () => {
  it("admin acessa todos os módulos", () => {
    expect(modulesFor("ADMIN")).toHaveLength(MODULES.length);
  });

  it("entregador só vê entregas", () => {
    expect(modulesFor("ENTREGADOR").map((m) => m.href)).toEqual(["/entregas"]);
    expect(canAccessPath("ENTREGADOR", "/financeiro")).toBe(false);
    expect(canAccessPath("ENTREGADOR", "/entregas/123")).toBe(true);
  });

  it("financeiro acessa financeiro e clientes, mas não estoque", () => {
    expect(canAccessPath("FINANCEIRO", "/financeiro/receber")).toBe(true);
    expect(canAccessPath("FINANCEIRO", "/clientes")).toBe(true);
    expect(canAccessPath("FINANCEIRO", "/estoque")).toBe(false);
  });

  it("não confunde prefixos parecidos", () => {
    expect(canAccessPath("ENTREGADOR", "/pedidosx")).toBe(true); // rota fora de módulo
    expect(canAccessPath("ENTREGADOR", "/pedidos")).toBe(false);
  });

  it("sem perfil não acessa nada", () => {
    expect(canAccessPath(undefined, "/")).toBe(false);
  });
});
