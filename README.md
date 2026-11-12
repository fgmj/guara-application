# Guará

Controle de caixa e estoque para revendas de gás, com várias filiais. Substitui as planilhas de controle usadas em cada filial.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma · Auth.js · Tailwind CSS

## Rodando localmente

Pré-requisitos: Node.js 22+ e Docker.

```bash
cp .env.example .env          # ajuste AUTH_SECRET e a senha do admin
npm install
npm run db:up                 # sobe o Postgres no Docker
npm run db:migrate            # aplica as migrations
npm run db:seed               # cria o usuário administrador
npm run dev                   # http://localhost:3000
```

Entre com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` definidos no `.env`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` / `typecheck` / `test` | Qualidade (também rodam no CI) |
| `npm run db:migrate` | Cria/aplica migrations após mudar `prisma/schema.prisma` |
| `npm run db:studio` | Interface visual do banco |

## Como funciona

| Tela | Quem usa | O que faz (aba da planilha que substitui) |
|---|---|---|
| Lançamentos | Funcionário e gestor | Vendas, compras, vales, despesas e fechamento do caixa do dia (Vendas, Compras, Vales, Despesas, Caixa, Relatório diário) |
| Painel | Gestor | Vendas, despesas e resultado do mês com projeção, média de 7 dias, estoque, pendências de caixa, últimos meses |
| Fechamento | Gestor | Resumo diário (Resumo) e total do caixa do mês por forma de recebimento |
| Relatórios | Gestor | Resultado mensal, venda por categoria/entregador/produto, despesas agrupadas (tabelas dinâmicas, DRE) |
| Estoque | Gestor | Posição de cheios e vazios, contagem, compras a pagar (Estoque Final Diário) |
| Vales | Gestor | Vales em aberto por cliente/funcionário |
| Cadastros | Gestor | Filiais, usuários, entregadores, formas de recebimento, produtos e categorias (LISTAS, configuração) |
| Importar planilha | Gestor | Carrega o histórico de um `.xlsx` baixado do Google Planilhas |

Regras principais (em `src/lib/resumo.ts` e `src/lib/caixa.ts`):

- **Estoque** é calculado: compras entram, vendas saem, contagens ajustam. Vazios = total de vasilhames − cheios.
- **Caixa do dia** = valores informados por forma de recebimento + vales lançados no dia + despesas pagas com o caixa.
  Deve bater com vendas do dia + vales recebidos no caixa, com tolerância de R$ 20.
- **Resultado** = vendas − custo dos produtos (cadastro) − despesas. Categorias marcadas como "não conta como venda"
  (troca, transferência, empréstimo) mexem no estoque mas ficam fora do preço médio e do resultado.
- **Projeção do mês** = realizado ÷ dias corridos × dias do mês.

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| Administrador / Gestor | Tudo, em todas as filiais |
| Funcionário | Só a tela de Lançamentos, nas filiais liberadas, nos últimos 7 dias e enquanto o caixa do dia estiver aberto |

As regras ficam em `src/lib/roles.ts` (middleware) e em `autorizar()` nas ações de lançamento.

## Nova filial

Em Cadastros: crie a filial, cadastre os entregadores e as formas de recebimento dela e marque a filial nos usuários.
Depois faça a contagem inicial em Estoque (ou importe a planilha antiga).

## Deploy (ex.: OCI Free Tier, Ampere A1 / ARM64)

```bash
export AUTH_SECRET=$(openssl rand -base64 32) POSTGRES_PASSWORD=<senha-forte>
docker compose --profile app up -d --build
docker compose exec -e SEED_ADMIN_EMAIL=admin@seudominio -e SEED_ADMIN_PASSWORD=<senha> app node prisma/seed.mjs   # 1ª vez
```

O container aplica as migrations pendentes ao iniciar e escuta em `127.0.0.1:3000`. O acesso externo é feito
pelo **Cloudflare Tunnel** (`gestao.supergas.com.br`), com HTTPS e sem abrir portas no servidor:

```bash
sudo cloudflared service install <TOKEN_DO_TUNEL>   # token em Zero Trust → Networks → Tunnels → guara
```
