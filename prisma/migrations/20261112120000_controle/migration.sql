-- CreateEnum
CREATE TYPE "ProdutoTipo" AS ENUM ('GAS', 'VASILHAME', 'OUTRO');

-- CreateEnum
CREATE TYPE "ValeRecebimento" AS ENUM ('CAIXA', 'CONTA', 'DESCONTO');

-- CreateEnum
CREATE TYPE "DespesaOrigem" AS ENUM ('CAIXA', 'CARTAO', 'CONTA');

-- CreateEnum
CREATE TYPE "FormaGrupo" AS ENUM ('CARTAO', 'DINHEIRO', 'PIX', 'OUTRO');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'GESTOR', 'FUNCIONARIO');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ((CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'FUNCIONARIO' END)::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'FUNCIONARIO';
COMMIT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'FUNCIONARIO';

-- CreateTable
CREATE TABLE "filiais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "ProdutoTipo" NOT NULL DEFAULT 'GAS',
    "baseId" TEXT,
    "custo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precos" TEXT NOT NULL DEFAULT '',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_venda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contaReceita" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregadores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "entregadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "entregadorId" TEXT,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnit" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "obs" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fornecedor" TEXT,
    "pagamento" TEXT,
    "vencimento" DATE,
    "pagoEm" DATE,
    "nota" TEXT,
    "obs" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vales" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "recebidoEm" DATE,
    "recebimento" "ValeRecebimento",
    "obs" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_despesa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesas" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "subcategoria" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "origem" "DespesaOrigem" NOT NULL DEFAULT 'CAIXA',
    "placa" TEXT,
    "km" INTEGER,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formas_recebimento" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" "FormaGrupo" NOT NULL DEFAULT 'CARTAO',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "formas_recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixas" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "obs" TEXT,
    "fechadoPor" TEXT,

    CONSTRAINT "caixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixa_itens" (
    "id" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "formaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "caixa_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_estoque" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FilialToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FilialToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "filiais_nome_key" ON "filiais"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_nome_key" ON "produtos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_venda_nome_key" ON "categorias_venda"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "entregadores_filialId_nome_key" ON "entregadores"("filialId", "nome");

-- CreateIndex
CREATE INDEX "vendas_filialId_data_idx" ON "vendas"("filialId", "data");

-- CreateIndex
CREATE INDEX "compras_filialId_data_idx" ON "compras"("filialId", "data");

-- CreateIndex
CREATE INDEX "vales_filialId_data_idx" ON "vales"("filialId", "data");

-- CreateIndex
CREATE INDEX "vales_filialId_recebidoEm_idx" ON "vales"("filialId", "recebidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_despesa_nome_key" ON "categorias_despesa"("nome");

-- CreateIndex
CREATE INDEX "despesas_filialId_data_idx" ON "despesas"("filialId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "formas_recebimento_filialId_nome_key" ON "formas_recebimento"("filialId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "caixas_filialId_data_key" ON "caixas"("filialId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "caixa_itens_caixaId_formaId_key" ON "caixa_itens"("caixaId", "formaId");

-- CreateIndex
CREATE INDEX "ajustes_estoque_filialId_data_idx" ON "ajustes_estoque"("filialId", "data");

-- CreateIndex
CREATE INDEX "_FilialToUser_B_index" ON "_FilialToUser"("B");

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregadores" ADD CONSTRAINT "entregadores_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_entregadorId_fkey" FOREIGN KEY ("entregadorId") REFERENCES "entregadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vales" ADD CONSTRAINT "vales_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_despesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formas_recebimento" ADD CONSTRAINT "formas_recebimento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixas" ADD CONSTRAINT "caixas_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_itens" ADD CONSTRAINT "caixa_itens_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_itens" ADD CONSTRAINT "caixa_itens_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "formas_recebimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_estoque" ADD CONSTRAINT "ajustes_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FilialToUser" ADD CONSTRAINT "_FilialToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "filiais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FilialToUser" ADD CONSTRAINT "_FilialToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

