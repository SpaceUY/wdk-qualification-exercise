# WDK Qualification Exercise

A P2P retail cashback loop built with React Native and NestJS. Users pay merchants in USDT on Ethereum Sepolia; the backend detects the payment on-chain, generates a 5% cashback coupon, and redeems it by sending UTL tokens directly to the user's self-custody wallet. The mobile app (Expo + WDK) handles wallet creation, biometric authentication, send/receive flows, and the cashback coupon UI.

## Monorepo structure

```
apps/
  rn-wdk-exercise/   # React Native wallet (Expo)
  backend/           # NestJS API + blockchain listener
infra/
  wdk-stack/         # Self-hosted WDK stack (indexers, transaction routers, ORK, app-node) — see infra/wdk-stack/README.md
```

**Tooling:** pnpm workspaces · Turborepo

## Prerequisites

- Node.js ^24 (required by `apps/backend`'s `engines` field)
- pnpm ≥ 10 (both apps pin `packageManager: pnpm@10.15.1`)
- MongoDB instance (local or remote; bundled in `apps/backend/docker-compose.yml`)
- Redis instance (local or remote — Bull queue backend; bundled in `apps/backend/docker-compose.yml`)
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

A Husky `pre-push` hook runs `pnpm test` (all apps, via Turborepo) and blocks the push if any test fails. It's installed automatically on `pnpm install` (root `prepare` script).

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

The mobile app's OAuth client uses the `space-utl://` URL scheme as its callback/logout URL (app display name "Northstar", package/bundle id `com.space.utl`) and PKCE (no client secret).

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

## Production deployment (AWS)

The backend runs as a single Docker container on **Elastic Beanstalk** (Amazon Linux 2023
Docker platform), built from `apps/backend/Dockerfile`. Configuration is injected through
the environment's properties and secrets — the development `docker-compose.yml` is
deliberately excluded from the deploy bundle so the platform always builds the production
container from the `Dockerfile`. The deployed stack uses:

- **Elastic Beanstalk** — orchestrates the EC2 instance, Application Load Balancer and
  Auto Scaling group that serve the containerized API.
- **Application Load Balancer + ACM** — public HTTPS termination (TLS 1.3) on a custom domain.
- **Amazon DocumentDB** — MongoDB-compatible database, TLS enabled.
- **Secrets Manager** — runtime credentials (RPC endpoints, JWT secret, API keys, treasury
  key) injected as environment secrets; no secrets in code, env files or bundles.
- **Amazon Cognito** — user authentication (provisioned via SST, see
  [Infrastructure](#infrastructure-aws-cognito-via-sst)).
- **CloudWatch Logs** — application/instance log streaming with a retention policy.
- **SNS** — environment health/event notifications.
- **S3** — CI-uploaded application bundles, one per commit.
- **Redis event bus** — consumed over private VPC networking from a sibling self-hosted
  WDK environment (see [infra/wdk-stack](#self-hosted-wdk-stack-infrawdk-stack)).

## CI/CD

The `.github/workflows/ci.yml` workflow runs on every push/PR to `main`:

1. **lint** — `pnpm lint` across the whole monorepo.
2. **test** — `pnpm test:coverage` + `pnpm test:e2e` (backend).
3. **build** — `pnpm build` + packages `apps/backend` into a zip (dev compose files and
   `.env*` excluded).
4. **deploy** — only on push to `main`: uploads the bundle to S3, registers it as a new
   application version (idempotent on retries) and updates the Elastic Beanstalk
   environment, then waits for the environment to report the new version healthy.

### Deploy authentication — OIDC role, least privilege

The deploy job holds **no long-lived AWS credentials**. It exchanges the workflow's
GitHub OIDC identity token for short-lived credentials by assuming a dedicated IAM role
whose trust policy only accepts tokens issued for this repository's `production`
deployment environment.

The role's permission policy is **least-privilege** — every write action is scoped to
this project's resources, with no wildcard admin policies:

- **Elastic Beanstalk** — create application versions and update the single target
  environment (plus the read-only describes the deploy loop needs).
- **S3** — limited to the Elastic Beanstalk deployment bucket (bundle upload and the
  internal objects the platform reads/writes during a deploy).
- **CloudFormation** — read/update scoped to the environment's own stack (an Elastic
  Beanstalk environment is a CloudFormation stack under the hood).
- **SNS** — only the environment's notification topic.
- **CloudWatch Logs** — create/configure only the environment's log groups (plus the
  account-level list call that AWS does not allow scoping).
- **Auto Scaling / EC2** — suspend/resume limited to the environment's Auto Scaling
  group, plus read-only describes.

For the `deploy` job to work, someone with write access to the AWS account must create
that IAM role and upload its ARN as the `AWS_DEPLOY_ROLE_ARN` secret in the GitHub repo
settings. Without that secret, the `lint`/`test`/`build` jobs work normally but `deploy` fails.
