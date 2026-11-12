import { describe, expect, it } from "vitest";
import { parseValor } from "./dinheiro";
import { diffDias, fimMes, somaDias, somaMeses } from "./datas";

describe("parseValor", () => {
  it("entende formatos brasileiros", () => {
    expect(parseValor("1.234,56")).toBe(1234.56);
    expect(parseValor("R$ 130")).toBe(130);
    expect(parseValor("96,56")).toBe(96.56);
    expect(parseValor("109.90")).toBe(109.9);
    expect(parseValor("")).toBeNaN();
    expect(parseValor("abc")).toBeNaN();
  });
});

describe("datas", () => {
  it("calcula dias e meses", () => {
    expect(somaDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(diffDias("2026-11-12", "2026-11-05")).toBe(7);
    expect(fimMes("2024-02")).toBe("2024-02-29");
    expect(somaMeses("2026-01", -1)).toBe("2025-12");
  });
});
