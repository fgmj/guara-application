import { describe, expect, it } from "vitest";
import { conferir, projetar } from "./resumo";

describe("conferência do caixa", () => {
  it("tolera até R$ 20 de diferença", () => {
    expect(conferir(1000, 1000)).toBe("ok");
    expect(conferir(1000, 980)).toBe("ok");
    expect(conferir(1000, 1020)).toBe("ok");
  });
  it("aponta falta e sobra", () => {
    expect(conferir(3951.65, 3296.56)).toBe("falta");
    expect(conferir(4668.12, 15088.12)).toBe("sobra");
  });
});

describe("projeção", () => {
  it("projeta o mês pelo ritmo atual", () => {
    expect(projetar(12000, 12, 30)).toBe(30000);
    expect(projetar(0, 0, 30)).toBe(0);
  });
});
