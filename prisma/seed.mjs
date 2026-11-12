import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Cadastros iniciais de uma revenda de gás. Só roda com o banco vazio. Filiais: SEED_FILIAIS="A,B" (padrão: Matriz). */
async function cadastrosIniciais() {
  if ((await prisma.filial.count()) > 0) return;

  // custo e preços sugeridos são preenchidos pelo gestor em Cadastros → Produtos
  const gas = ["P13", "P5", "P20", "P45"];
  let ordem = 0;
  for (const nome of gas) {
    const p = await prisma.produto.create({ data: { nome, tipo: "GAS", ordem: ordem++ } });
    await prisma.produto.create({
      data: { nome: `${nome} - VASILHAME`, tipo: "VASILHAME", baseId: p.id, ordem: 10 + ordem },
    });
  }
  for (const nome of ["Kit gás", "Serviço Sempre Gás", "Água"]) {
    await prisma.produto.create({ data: { nome, tipo: "OUTRO", ordem: 30 + ordem++ } });
  }

  const categorias = [["PEDIDOS", true], ["PORTARIA", true], ["COMÉRCIO", true], ["AGREGADOS", true], ["TROCA", false], ["TRANSFERÊNCIA", false], ["EMPRÉSTIMO", false]];
  await prisma.categoriaVenda.createMany({ data: categorias.map(([nome, contaReceita], i) => ({ nome, contaReceita, ordem: i })) });

  const despesas = ["Administrativo", "Água", "Aluguel", "Animais", "Carros", "Diversos", "Energia", "Escritório", "Impostos", "Marketing", "Mat. de limpeza", "Pessoal", "Pró-labore", "Telefone"];
  await prisma.categoriaDespesa.createMany({ data: despesas.map((nome) => ({ nome })) });

  const formas = [["CARTÃO", "CARTAO"], ["DINHEIRO", "DINHEIRO"], ["PIX", "PIX"]];
  const filiais = (process.env.SEED_FILIAIS || "Matriz").split(",").map((n) => n.trim()).filter(Boolean);
  for (const nome of filiais) {
    await prisma.filial.create({ data: { nome, formas: { create: formas.map(([nome, grupo], i) => ({ nome, grupo, ordem: i })) } } });
  }
  console.log(`Cadastros iniciais criados (filiais: ${filiais.join(", ")}).`);
}

async function admin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await prisma.user.upsert({ where: { email }, update: {}, create: { name: "Administrador", email, passwordHash, role: "ADMIN" } });
  console.log(`Administrador pronto: ${u.email}`);
}

cadastrosIniciais()
  .then(admin)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
