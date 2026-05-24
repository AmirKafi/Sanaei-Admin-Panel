# Sanaei Admin Panel

Admin dashboard for managing **Sanaei / 3X-UI** VPN inbounds and clients: sync from panel, usage tracking, and client migration between inbounds.

## Stack

- Next.js (App Router) + TypeScript
- SQLite + Prisma
- Tailwind CSS + Radix UI

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

## Setup

1. Clone and install:

```bash
pnpm install
```

2. Copy environment file and configure:

```bash
cp .env.example .env
```

Set at minimum:

- `DATABASE_URL` — SQLite path
- `AUTH_SECRET` — random string (16+ characters)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — admin panel login

3. Initialize database:

```bash
pnpm prisma:generate
pnpm prisma:db:push
```

4. Start development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

5. Configure **Settings** with your Sanaei panel URL and API credentials.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:db:push` | Apply schema to SQLite |

## Deployment

### Vercel

1. Push to GitHub and import the project in Vercel.
2. Set environment variables from `.env.example` (use Vercel **Postgres** or keep SQLite only for demos — for production prefer a persistent DB volume or hosted SQLite).
3. Build command: `npm run build`
4. Note: SQLite on serverless is ephemeral unless you attach persistent storage.

### Docker (self-hosted)

Example outline:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

Mount a volume for `prisma/dev.db` (or your `DATABASE_URL` path) so data persists.

### Environment checklist

- `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `DATABASE_URL`
- Panel credentials can be set in the UI after first login

## Authentication

- Session cookie (`httpOnly`, signed with `AUTH_SECRET`)
- All `/api/*` routes except `/api/auth/login` require a valid session
- Optional: set admin username/password in **Settings → Admin Login** (stored in DB)

## Testing

```bash
pnpm test
```

## License

Private / project use.
