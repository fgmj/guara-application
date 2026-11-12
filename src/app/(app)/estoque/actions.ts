"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getContexto } from "@/lib/contexto";
import { hoje, paraDate } from "@/lib/datas";
import { listarProdutos, resumoDias } from "@/lib/resumo";

/** Grava a contagem física: gera os ajustes necessários para o sistema bater com o que foi contado. */
export async function salvarContagem(filialId: string, formData: FormData) {
  const ctx = await getContexto();
  if (!ctx.gestor || !ctx.filiais.some((f) => f.id === filialId)) return;
  const dia = hoje();
  const [produtos, [r]] = await Promise.all([listarProdutos(false), resumoDias([filialId], dia, dia)]);
  const motivo = String(formData.get("motivo") ?? "").trim() || "Contagem";
  const ajustes: { produtoId: string; quantidade: number }[] = [];
  for (const g of produtos.filter((p) => p.tipo === "GAS")) {
    const ch = formData.get(`cheios-${g.id}`);
    const vz = formData.get(`vazios-${g.id}`);
    if (ch === null || ch === "" || vz === null || vz === "") continue;
    const cheios = Math.max(0, Math.trunc(Number(ch))), vazios = Math.max(0, Math.trunc(Number(vz)));
    if (!Number.isFinite(cheios + vazios)) continue;
    const dCheios = cheios - (r.cheios[g.id] ?? 0);
    const dCascos = cheios + vazios - (r.cascos[g.id] ?? 0);
    const casco = produtos.find((p) => p.tipo === "VASILHAME" && p.baseId === g.id);
    if (dCheios) ajustes.push({ produtoId: g.id, quantidade: dCheios });
    if (dCascos && casco) ajustes.push({ produtoId: casco.id, quantidade: dCascos });
  }
  if (ajustes.length) {
    await prisma.ajusteEstoque.createMany({ data: ajustes.map((a) => ({ ...a, filialId, data: paraDate(dia), motivo, criadoPor: ctx.user.name })) });
  }
  revalidatePath("/", "layout");
}

export async function marcarCompraPaga(id: string, pago: boolean) {
  const ctx = await getContexto();
  if (!ctx.gestor) return;
  await prisma.compra.update({ where: { id }, data: { pagoEm: pago ? paraDate(hoje()) : null } });
  revalidatePath("/estoque");
}
