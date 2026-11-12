import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { chave, lerPlanilha } from "./importar";

function planilha() {
  const wb = new ExcelJS.Workbook();
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  wb.addWorksheet("Vendas").addRows([
    ["DATA", "", "", "", "CATEGORIA", "DETALHE", "ENTREGADOR", "PRODUTO", "Quantidade", "VALOR UN", "VALOR"],
    [d("2026-11-03"), "", "", "", "", "PEDIDOS", "Carlos", "P13", 11, 130, { formula: "I2*J2", result: 1430 }],
    [d("2026-11-03"), "", "", "", "", "PEDIDOS", "Beto ", "P13 - VAZILHAME", 1, 130, { formula: "I3*J3", result: 130 }],
    ["", "", "", "", "", "", "", "", "", "", { formula: "I4*J4", result: 0 }],
  ]);
  wb.addWorksheet("Compras").addRows([
    ["DATA", "ANO", "MES", "SEMANA", "PRODUTO", "QUANTIDADE", "BOLETO / TAG", "Empresa NFE", "OBSERVAÇÃO", "NÚMERO NOTA", "VALOR", "DATA VENCIMENTO"],
    [d("2026-11-03"), 2026, 11, 45, "P13", 113, "Boleto", "Distribuidora X", "obs", "123", 9661.5, d("2026-11-10")],
  ]);
  wb.addWorksheet("Vales").addRows([
    ["DATA", "DESCRIÇÃO", "VALOR", "DATA RECEBIMENTO", "TIPO RECEBIMENTO", "OBSERVAÇÃO 1"],
    [d("2026-10-29"), "Cliente A", 575, d("2026-11-04"), "Caixa do dia", "NF 10"],
    [d("2026-10-20"), "Vale Funcionário", 200, d("2026-10-30"), "Descontar no pagamento", ""],
    [d("2026-11-03"), "Cliente A", 460, "", "Caixa do dia", ""],
  ]);
  wb.addWorksheet("Despesas").addRows([
    ["DATA", "DESCRIÇÃO", "PLACA", "KM", "CATEGORIA", "SUBCATEGORIA", "VALOR", "ORIGEM"],
    [d("2026-10-19"), "Abastecimento", "abc-1234", 120500, "Carros", "", 378.5, "Cartão"],
    [d("2026-10-22"), "Conta de água", "", "", "Agua", "", 98, "Caixa"],
    ["", "", "", "", "", "", "", "Caixa"],
  ]);
  wb.addWorksheet("Caixa").addRows([
    ["A", "B", "C", "DATA", "CARTÃO - MAQUININHA 1", "CARTÃO", "DINHEIRO", "PIX - CHAVE", "PIX", "VALES A RECEBER", "DESPESAS CAIXA", "TOTAL", "29/11/2024"],
    ["", "", "", d("2026-11-03"), 2415, { formula: "E2", result: 2415 }, 130, 420, { formula: "H2", result: 420 }, { formula: "x", result: 460 }, { formula: "x", result: 0 }, { formula: "x", result: 3425 }],
  ]);
  wb.addWorksheet("Estoque Final Diário").addRows([
    ["", "", "", "DATA", "P5", "P13", "P20", "P45", "P5 - VAZILHAME", "P13 - VAZILHAME", "P20 - VAZILHAME", "P45 - VAZILHAME", "Agua"],
    ["", "", "", d("2026-11-03"), 0, 95, 1, 3, 1, 106, 1, 5],
  ]);
  return wb;
}

describe("importação da planilha", () => {
  const r = lerPlanilha(planilha());
  it("lê vendas e ignora linhas vazias", () => {
    expect(r.vendas).toHaveLength(2);
    expect(r.vendas[0]).toMatchObject({ dia: "2026-11-03", categoria: "PEDIDOS", entregador: "Carlos", produto: "P13", quantidade: 11, valorUnit: 130, total: 1430 });
    expect(r.vendas[1]).toMatchObject({ entregador: "Beto", produto: "P13 - VASILHAME" });
  });
  it("lê compras, vales e despesas", () => {
    expect(r.compras[0]).toMatchObject({ produto: "P13", quantidade: 113, valor: 9661.5, pagamento: "Boleto", fornecedor: "Distribuidora X", nota: "123", vencimento: "2026-11-10" });
    expect(r.vales.map((v) => v.recebimento)).toEqual(["CAIXA", "DESCONTO", null]);
    expect(r.vales[0]).toMatchObject({ recebidoEm: "2026-11-04", obs: "NF 10" });
    expect(r.despesas).toHaveLength(2);
    expect(r.despesas[0]).toMatchObject({ origem: "CARTAO", placa: "ABC-1234", km: 120500 });
    expect(r.despesas[1].origem).toBe("CAIXA");
  });
  it("no caixa, importa só as colunas digitadas", () => {
    expect(r.caixa).toEqual([
      { dia: "2026-11-03", forma: "CARTÃO - MAQUININHA 1", valor: 2415 },
      { dia: "2026-11-03", forma: "DINHEIRO", valor: 130 },
      { dia: "2026-11-03", forma: "PIX - CHAVE", valor: 420 },
    ]);
  });
  it("lê a posição do estoque", () => {
    expect(r.estoque.get("2026-11-03")).toMatchObject({ P13: 95, "P13 - VASILHAME": 106, P45: 3 });
  });
  it("compara nomes sem acento", () => {
    expect(chave(" Comércio ")).toBe(chave("COMERCIO"));
  });
});
