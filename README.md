# WDK Qualification Exercise

A P2P retail cashback loop built with React Native and NestJS. Users pay merchants in USDT on Ethereum Sepolia; the backend detects the payment on-chain, generates a 5% cashback coupon, and redeems it by sending UTL tokens directly to the user's self-custody wallet. The mobile app (Expo + WDK) handles wallet creation, biometric authentication, send/receive flows, and the cashback coupon UI.

## Monorepo structure

```
apps/
  rn-wdk-exercise/   # React Native wallet (Expo)
  backend/           # NestJS API + blockchain listener
infra/
  wdk-stack/         # Self-hosted WDK stack (indexers, transaction routers, ORK, app-node) — see infra/wdk-stack/README.md
packages/            # Shared packages (if any)
```

**Tooling:** pnpm workspaces · Turborepo

## Prerequisites

- Node.js ^24 (required by `apps/backend`'s `engines` field)
- pnpm ≥ 10 (both apps pin `packageManager: pnpm@10.15.1`)
- MongoDB instance (local or remote; bundled in `docker-compose.yml`)
- Redis instance (local or remote — Bull queue backend; bundled in `docker-compose.yml`)
- Ethereum Sepolia RPC endpoint (HTTP — used to sign/send the UTL cashback payout)
- WDK Indexer API key — free, from [docs.wdk.tether.io/tools/indexer-api/get-started](https://docs.wdk.tether.io/tools/indexer-api/get-started) — used to detect incoming USDT payments
- AWS Cognito User Pool (provision it with `pnpm infra:dev` — see [Infrastructure](#infrastructure-aws-cognito-via-sst))
- AWS account/profile with SST permissions, if you need to (re)deploy the Cognito stack

## Quick start

```bash
# Install dependencies (run from the repo root — a workspace-level
# pnpm.overrides fix resolves the RN app's native/git deps correctly)
pnpm install

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
| [`apps/backend`](apps/backend/README.md) | NestJS REST API, WDK-indexer cashback pipeline (Redis/Bull), UTL ERC-20, Swagger, Docker |
| [`apps/rn-wdk-exercise`](apps/rn-wdk-exercise/README.md) | Expo React Native wallet with WDK, Cognito auth, cashback UI |

## Self-hosted WDK stack (infra/wdk-stack)

An optional, fully self-hosted replacement for the hosted WDK Indexer API — indexers, transaction routers, data shard, ORK, and app-node running as Docker containers, covering Ethereum (Sepolia), Bitcoin (**mainnet**), Spark (**mainnet**, a Bitcoin L2), and Tron (Nile testnet). Bitcoin and Spark run on mainnet as an explicit project requirement (real funds); the other chains stay on testnet. The backend can point at either transport via `INDEXER_TRANSPORT` (see [`apps/backend/README.md`](apps/backend/README.md#transfer-indexing-pipeline)). See [`infra/wdk-stack/README.md`](infra/wdk-stack/README.md) for setup and `docs/wdk-self-hosted-stack/` for the full design docs.

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

## CI/CD

`.github/workflows/ci.yml` runs `lint → test → build → deploy` on every push/PR to `main`. The
`deploy` stage (backend only) targets **AWS Elastic Beanstalk** and only runs on pushes to `main` —
it requires an Elastic Beanstalk application/environment and a handful of GitHub Actions secrets
that don't exist yet (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
`EB_APPLICATION_NAME`, `EB_ENVIRONMENT_NAME`); until then, `lint`/`test`/`build` still run and pass
on every PR, but `deploy` will fail. `apps/rn-wdk-exercise` isn't deployed here — mobile builds are
a separate EAS/Xcode/Android Studio concern (`apps/rn-wdk-exercise/eas.json` has the build/submit
profiles).

See [`docs/deployment-guide.md`](docs/deployment-guide.md) for the full step-by-step runbook —
provisioning the not-yet-created Elastic Beanstalk environments (backend and the self-hosted WDK
stack), wiring the secrets above, and shipping the mobile app to the App Store and Google Play.
