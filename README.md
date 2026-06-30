# WDK Qualification Exercise

A P2P retail cashback loop built with React Native and NestJS. Users pay merchants in USDT on Ethereum Sepolia; the backend detects the payment on-chain, generates a 5% cashback coupon, and redeems it by sending UTL tokens directly to the user's self-custody wallet. The mobile app (Expo + WDK) handles wallet creation, biometric authentication, send/receive flows, and the cashback coupon UI.

## Monorepo structure

```
apps/
  rn-wdk-exercise/   # React Native wallet (Expo)
  backend/           # NestJS API + blockchain listener
packages/            # Shared packages (if any)
```

**Tooling:** pnpm workspaces · Turborepo

## Prerequisites

- Node.js ^24 (required by `apps/backend`'s `engines` field)
- pnpm ≥ 10 (both apps pin `packageManager: pnpm@10.15.1`)
- PostgreSQL instance (local or remote)
- Ethereum Sepolia RPC endpoint (HTTP + optional WebSocket)
- AWS Cognito User Pool (provision it with `pnpm infra:dev` — see [Infrastructure](#infrastructure-aws-cognito-via-sst))
- AWS account/profile with SST permissions, if you need to (re)deploy the Cognito stack

## Quick start

```bash
# Install dependencies (run from each app individually due to RN native deps)
cd apps/backend && pnpm install --ignore-workspace

# Configure environment
cp apps/backend/.env.example apps/backend/.env.local
# Fill in the values (see backend README for details)

# Run in development mode
cd apps/backend && pnpm start:dev
```

## Running tests

```bash
cd apps/backend && pnpm test
cd apps/backend && pnpm test:coverage
```

## Apps

| App | Description |
|---|---|
| [`apps/backend`](apps/backend/README.md) | NestJS REST API, blockchain event listener, UTL ERC-20, Docker |
| [`apps/rn-wdk-exercise`](apps/rn-wdk-exercise/README.md) | Expo React Native wallet with WDK, Cognito auth, cashback UI |

## Infrastructure (AWS Cognito via SST)

Both apps depend on a shared AWS Cognito User Pool for authentication. It's provisioned as code via [SST](https://sst.dev) (`sst.config.ts` + `infra/cognito.ts`) rather than created manually in the console.

```bash
# Configure your AWS profile in sst.config.ts (providers.aws.profile), then:
pnpm infra:dev          # deploy the Cognito stack to the "dev" stage
pnpm infra:output       # print the deployed userPoolId / userPoolClientId / cognitoDomain
pnpm infra:prod         # deploy to the "production" stage
pnpm infra:remove:dev   # tear down the "dev" stage
```

Take the printed `userPoolId` and feed it into:
- `apps/backend/.env.local` → `COGNITO_USER_POOL_ID`
- `apps/rn-wdk-exercise/.env.local` → `EXPO_PUBLIC_COGNITO_DOMAIN` (from `cognitoDomain`) and `EXPO_PUBLIC_COGNITO_CLIENT_ID` (from `userPoolClientId`)

The mobile app's OAuth client uses `rn-wdk-exercise://` as its callback/logout URL and PKCE (no client secret).

## Docker Quick Start (backend)

```bash
cd apps/backend
cp .env.example .env.local   # fill in values
docker compose up --build
```

See [`apps/backend/README.md`](apps/backend/README.md#docker-quick-start) for the full guide.

## Common scripts (from repo root via Turborepo)

| Command | Description |
|---|---|
| `pnpm build` | Build all apps |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Lint all apps |
