# Guará

Sistema de gestão para distribuição: **clientes, estoque, pedidos, entregas e financeiro**.

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

## Perfis de acesso

| Perfil | Módulos |
|---|---|
| Administrador | Todos |
| Atendente | Clientes, Estoque, Pedidos, Entregas |
| Entregador | Entregas (tela pensada para celular) |
| Financeiro | Clientes, Financeiro |

As regras ficam em `src/lib/roles.ts` e são aplicadas no middleware.

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

## Roadmap

1. ✅ Base: projeto, banco, login com perfis, CI
2. Clientes
3. Estoque (produtos e vasilhames)
4. Pedidos e entregas
5. Financeiro
