import { describe, expect, it } from "vitest";
import { canAccessPath, homeFor, modulesFor } from "./roles";

describe("perfis", () => {
  it("gestor e admin acessam tudo", () => {
    for (const r of ["ADMIN", "GESTOR"] as const) {
      expect(canAccessPath(r, "/painel")).toBe(true);
      expect(canAccessPath(r, "/relatorios")).toBe(true);
      expect(homeFor(r)).toBe("/painel");
    }
  });
  it("funcionário só lança", () => {
    expect(canAccessPath("FUNCIONARIO", "/lancar")).toBe(true);
    expect(canAccessPath("FUNCIONARIO", "/conta")).toBe(true);
    expect(canAccessPath("FUNCIONARIO", "/dia")).toBe(true);
    for (const p of ["/", "/painel", "/relatorios", "/fechamento", "/estoque", "/cadastros", "/lancarx"]) {
      expect(canAccessPath("FUNCIONARIO", p)).toBe(false);
    }
    expect(modulesFor("FUNCIONARIO").map((m) => m.href)).toEqual(["/lancar", "/dia"]);
    expect(homeFor("FUNCIONARIO")).toBe("/lancar");
  });
  it("sem perfil não acessa nada", () => {
    expect(canAccessPath(undefined, "/lancar")).toBe(false);
  });
});
