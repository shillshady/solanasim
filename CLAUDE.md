# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VirtualSol is a full-stack Solana paper trading platform with real-time price tracking, PnL calculations, leaderboards, and rewards. Monorepo with Next.js frontend and Fastify backend.

## Project Structure

```
VirtualSol/
├── frontend/          # Next.js 14+ (App Router), Tailwind v4
├── backend/           # Fastify + Prisma (ESM, "type": "module")
├── packages/types/    # Shared TypeScript types
```

**Node >= 20 required.**

## Common Commands

### Backend (`cd backend`)

```bash
npm run dev                # Start dev server with tsx
npm run dev:worker         # Start background worker process
npm run build              # Generate Prisma client + tsc
npm test                   # Run Jest tests
npx jest path/to/file      # Run a single test file

# Database
npm run prisma:dev         # Create new migration (dev only)
npm run prisma:migrate     # Deploy existing migrations
npm run prisma:generate    # Regenerate Prisma client
npm run db:reset           # Reset database
npm run db:seed            # Seed database
npx prisma studio          # Open Prisma Studio GUI
```

### Frontend (`cd frontend`)

```bash
npm run dev                # Start Next.js dev server
npm run build              # Build for production
npm test                   # Run Vitest
npx vitest path/to/file    # Run a single test file
npm run test:coverage      # Coverage report
npm run lint               # ESLint
npm run lint:fix           # Auto-fix ESLint
npm run type-check         # TypeScript check (no emit)
```

### Monorepo Root

```bash
npm run dev:backend        # Alias for backend dev
npm run dev:frontend       # Alias for frontend dev
npm run build              # Build both
npm test                   # Test both
npm run db:migrate         # Deploy migrations
npm run db:generate        # Generate Prisma client
npm run clean              # Remove all node_modules and build artifacts
```

## Architecture Patterns

### Backend Service Pattern

`backend/src/` follows routing → service → database:

1. **Routes** (`routes/`) - API endpoints registered with Fastify
2. **Services** (`services/`) - Business logic with async/await
3. **Plugins** (`plugins/`) - Shared functionality (auth, redis, websocket, price service)
4. **Utils** (`utils/`) - Helpers

Key services:
- `tradeService.ts` - Trade execution and validation
- `portfolioService.ts` - Position management and PnL
- `priceService-v2.ts` - Real-time price streaming via Helius WebSocket
- `rewardService.ts` - VSOL token reward distribution
- `walletTrackerService.ts` - KOL wallet tracking

The backend also runs a **worker process** (`src/worker.ts`) for background tasks (start with `npm run dev:worker`).

### FIFO Position Tracking

Strict FIFO accounting for trade lots via `Position`, `PositionLot`, `RealizedPnL` models.

- **Buy trades** create `PositionLot` entries (`qtyRemaining`, `unitCostUsd`, `createdAt`)
- **Sell trades** consume lots in `createdAt ASC` order, calculating realized PnL per lot
- Implementation: `backend/src/utils/pnl.ts`, `backend/src/services/pnl.ts`

### Real-time Price Service

`backend/src/plugins/priceService-v2.ts` streams swap events from Solana DEXes via Helius WebSocket:

1. `logsSubscribe` to DEX programs (Raydium V4, CLMM, Pump.fun)
2. Parse swap events from transaction logs
3. Convert swap ratios to USD via SOL/USDC/USDT pairs
4. Multi-layer cache: memory → Redis → fallback APIs (DexScreener, Jupiter, CoinGecko)
5. Broadcast via Redis pub/sub

### Frontend Data Flow

- **State**: TanStack Query (`staleTime: 30s`, `cacheTime: 5m`, `refetchOnWindowFocus: false`)
- **Real-time**: WebSocket connection to backend price stream
- **Providers**: Auth, PriceStream, Theme, Query (in `frontend/lib/`)
- **Key hooks**: `usePortfolioQuery`, `useRewardsQuery`, `useLeaderboardQuery`

### Database Schema Highlights

Core tables: `User`, `Trade`, `Position`, `PositionLot`, `TransactionHistory`, `Token`, `RewardSnapshot`, `RewardClaim`

Important indexes:
- `trades`: `userId + timestamp DESC`
- `positions`: `userId + mint`
- `positionLots`: `userId + mint + createdAt ASC` (FIFO ordering)

### WebSocket Architecture

Backend WS plugins (`plugins/ws.ts`, `ws/server.ts`) must be registered BEFORE rate limiting middleware. Frontend connects via `frontend/lib/ws.ts` and subscribes to per-token price streams.

## Critical Implementation Notes

### WebSocket Registration Order

In `backend/src/index.ts`, WS routes MUST register BEFORE rate limiting:

```typescript
app.register(websocket)
app.register(wsPlugin)
app.register(rateLimiting)  // AFTER WebSocket routes
```

### FIFO Lot Consumption

Always consume lots oldest-first:

```typescript
const lots = await prisma.positionLot.findMany({
  where: { userId, mint },
  orderBy: { createdAt: 'asc' }  // CRITICAL
});
```

### Price Service Initialization

Price service MUST start before Fastify listens:

```typescript
await priceService.start();
app.listen({ port, host: "0.0.0.0" });
```

### Decimal Precision

Use `Decimal` from Prisma for all financial math:

```typescript
import { Decimal } from '@prisma/client/runtime/library';
const totalCost = new Decimal(price).mul(quantity);  // NOT price * quantity
```

## Frontend Conventions

### Next.js Patterns

- Prefer **named exports** over default exports
- Minimize `'use client'` — keep most components as RSC, create small client wrappers for interactivity
- Use `nuqs` for URL search param state management
- Wrap client components in `Suspense` with skeleton fallbacks

### Brand & Visual Identity

- **Aesthetic**: Black-and-white minimalist trading UI
- **Accent**: Gradient teal → purple (`--gradient-primary`)
- **Fonts**: IBM Plex Sans Bold (headings), JetBrains Mono (data/numbers), muted gray for secondary text
- **Effects**: Glass-morphism and subtle glow on cards/modals; Framer Motion fade/slide (150–300ms)
- Use shadcn/ui primitives for consistent accessibility

### Numeric Formatting

All monetary/numeric displays must use helpers from `lib/format.ts`:
- `formatUSD`, `formatPriceUSD`, `formatQty`, `safePercent`
- Show both USD and SOL equivalents via `SolEquiv` component
- Guard divide-by-zero → display "—"
- Never round before aggregating; only at render

Precision rules:
| Value | Format |
|---|---|
| USD >= $10K | Compact (`$12.3K`) |
| USD < $10K | 2 decimals |
| Price < $1 | 3-6 decimals |
| Qty < 1 | 4-6 decimals |
| Percent | Always show sign (+/-), 2 decimals |

### Responsive Layout

- Grid/flex with `gap-4` desktop, `gap-2` mobile
- Breakpoints: 1-col mobile → 2-col tablet → 3-4-col desktop
- Vertical rhythm: spacing multiples of 4px

## Environment Variables

**Backend** (`.env`): `DATABASE_URL`, `REDIS_URL`, `HELIUS_API`, `HELIUS_RPC_URL`, `HELIUS_WS`, `SOLANA_RPC_URL`, `JWT_SECRET`, `VSOL_TOKEN_MINT`, `REWARDS_WALLET_SECRET`

**Frontend** (`.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`

## Git Workflow

- **`dev`** — Active development
- **`staging`** — Pre-production testing
- **`main`** — Production only

Deploy: Railway (backend, root dir: `backend`) + Vercel (frontend, root dir: `frontend`).

## Testing

- **Backend**: Jest — `npm test` in `backend/`
- **Frontend**: Vitest + React Testing Library + MSW — `npm test` in `frontend/`
