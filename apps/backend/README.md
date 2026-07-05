# Backend — Cashback API

NestJS REST API that powers the P2P retail cashback loop. It detects USDT payments to merchant addresses on Ethereum Sepolia via the hosted WDK Indexer API, generates 5% cashback coupons, and redeems them by transferring UTL tokens from a treasury wallet.

## Architecture

```
src/
├── config/            # Namespaced ConfigModule factories (cognito, database, blockchain, redis, wdkIndexer)
├── auth/               # Cognito RS256 JWT guard via jwks-rsa + passport-jwt
├── users/              # User registry (cognitoSub + email + walletAddress)
├── wallets/            # Encrypted seed backup + wallet address registration
├── coupons/            # Coupon lifecycle: creation by the indexer processor, redemption via UTL transfer
├── modules/indexer/    # Transfer detection → Bull queue → coupon-creation pipeline (port/adapter/consumer/processor);
│                       # pluggable transport — self-hosted WDK Redis stream (default) or hosted WDK Indexer API (legacy fallback)
├── wdk/                # HTTP client for the hosted WDK Indexer API (wdk-api.tether.io)
└── wdk-app-node/       # Mints short-lived JWTs so the mobile app can call app-node's own REST API directly
```

**Stack:** NestJS 10 · Mongoose · MongoDB · Redis + Bull · ethers v6 · AWS Cognito (RS256 JWTs) · `@nestjs/schedule` · `@nestjs/swagger`

## API docs

Interactive Swagger UI is served at `/api/docs` (JSON at `/api/docs-json`) whenever `NODE_ENV !== 'production'`. Use the "Authorize" button with a Cognito `id` token to try authenticated routes directly.

## API endpoints

All endpoints require a Cognito `id` token in the `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/coupons` | List the authenticated user's unredeemed cashback coupons |
| `GET` | `/coupons/claimed` | List the authenticated user's redeemed cashback coupons |
| `POST` | `/wallets/backup` | Upsert encrypted seed ciphertext for the authenticated user |
| `PUT` | `/wallets/address` | Register or update the user's EVM wallet address |
| `POST` | `/coupons/claim` | Redeem a cashback coupon — transfers UTL tokens to the user's wallet |
| `GET` | `/wdk-app-node/token` | Mint a short-lived JWT for the self-hosted WDK stack's app-node API (see below) |

### `GET /coupons`

```json
// Response 200
[
  {
    "id": "<uuid>",
    "code": "<32-char hex>",
    "usdtAmountRaw": "1000000",
    "utlAmountRaw": "50000000000000000",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /coupons/claimed`

```json
// Response 200
[
  {
    "id": "<uuid>",
    "usdtAmountRaw": "1000000",
    "utlAmountRaw": "50000000000000000",
    "redeemedAt": "2024-01-01T00:00:00.000Z",
    "redemptionTxHash": "0x...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `POST /wallets/backup`

```json
// Request
{ "ciphertext": "<base64-encoded AES-GCM blob>" }

// Response 201
{ "id": "<backup-uuid>" }
```

`ciphertext` is checked by a custom class-validator constraint, `IsWdkBackupCiphertextConstraint`
(`src/wallets/dto/is-wdk-backup-ciphertext.validator.ts`) — it verifies the blob's shape and
version byte (base64-decoded length ≥ version + 16-byte salt + 12-byte IV + 16-byte GCM tag,
and a recognized version byte) but never decrypts it; the passphrase never leaves the client.
The accepted version bytes must stay in sync with the mobile app's own versioned scheme
(`apps/rn-wdk-exercise/utils/seedEncryption.ts`'s `SCRYPT_PARAMS_BY_VERSION`) — currently `0x01`
(legacy) and `0x02` (current, scrypt N=2¹⁷ per the OWASP Password Storage Cheat Sheet).

### `PUT /wallets/address`

```json
// Request
{ "walletAddress": "0xabc..." }

// Response 200
{ "walletAddress": "0xabc..." }
```

### `POST /coupons/claim`

```json
// Request
{ "code": "<32-char hex coupon code>" }

// Response 201
{ "redemptionTxHash": "0x..." }
```

## Transfer indexing pipeline

`src/modules/indexer/` detects merchant USDT payments behind a `TransferStreamPort` abstraction, so the transport can be swapped without touching anything downstream. Selected via the `INDEXER_TRANSPORT` env var:

- **`redis-stream` (default)** — reads directly from the self-hosted WDK stack's Redis event bus (`infra/wdk-stack`), the same stream `indexer-processor` consumes for `app-node`'s own balance/history endpoints.
  - **`RedisStreamTransferAdapter`** — runs a dedicated consumer group (`WDK_EVENT_BUS_CONSUMER_GROUP`) on the stream via a *blocking* `XREADGROUP` (5s block), not a timer poll. This has to be blocking: `indexer-processor` runs its own consumer group on the same stream and `XDEL`s every message right after processing — which removes it for every consumer group, not just its own — so a slow poll loses that race almost every time. Grouped-transaction messages are parsed (`adapters/grouped-transaction.util.ts`, matching the wire format from `@tetherto/wdk-indexer-wrk-base`'s `_publishTransfers`), filtered down to merchant-bound USDT transfers, and converted from human-decimal amounts to raw base units before validation.
  - `pollIntervalMs()` returns `0` — the blocking `XREADGROUP` call already provides the wait, so the consumer loop's own delay is a no-op here.
- **`hosted-api` (deprecated fallback)** — the original transport, kept only for instant rollback. **`WdkIndexerTransferAdapter`** polls `WdkService` (`src/wdk/wdk.service.ts`, a thin client for `wdk-api.tether.io`) per configured merchant address and tracks a per-merchant cursor in the `indexer_states` collection so restarts don't reprocess old transfers. `pollIntervalMs()` returns 30s.

Shared downstream of either transport:
- **`TransferConsumerService`** — runs a continuous read-enqueue loop for the app's lifetime (not a fixed cron tick), so a blocking adapter's consumer is always listening; pushes one Bull job per new transfer event.
- **`TransferProcessor`** (`@Processor('transfers')`) — the actual cashback logic: filters merchant + resolves the sender's user, computes the UTL cashback, and creates the `Coupon` document.
- **Idempotency:** `coupons.txHash` has a `UNIQUE` index — duplicate jobs silently discard the second insert (Mongo duplicate-key error `11000`); unexpected errors are rethrown so Bull retries with backoff.

Bull requires Redis — see the `redis` service in `docker-compose.yml`. This is a **different** Redis instance than the WDK event bus above (`WDK_EVENT_BUS_REDIS_HOST`/`PORT`) — Bull only uses its own instance as a queue backing store, never as an event source.

`scripts/verify-redis-stream-adapter.ts` is a manual smoke-test, not part of the Jest suite — it
instantiates the real `RedisStreamTransferAdapter` against a running `infra/wdk-stack` Redis and
prints whatever it reads, with no assertions. Useful for confirming the stream/consumer-group
wiring is live end-to-end while debugging, outside of the mocked unit tests:
```bash
npx ts-node scripts/verify-redis-stream-adapter.ts
```

### Cashback math

```
UTL raw = USDT raw × 500 / 10000 × 10^12
```

The `10^12` factor adjusts for the decimal difference between USDT (6 decimals) and UTL (18 decimals). Example: 1 USDT → 0.05 UTL.

## App-node auth bridge (`GET /wdk-app-node/token`)

The mobile app talks directly to the self-hosted WDK stack's `app-node` REST API (`infra/wdk-stack`) for wallet registration and transaction history — a separate concern from this backend's own cashback API, using app-node's own auth scheme (HS256 JWT, payload `{ userId }`, verified against a shared secret) rather than Cognito.

Since that's a symmetric shared secret, the mobile app can't be trusted to hold it directly — instead, `WdkAppNodeService.mintToken()` signs a short-lived token server-side (this endpoint is Cognito-guarded like everything else), scoped to the authenticated user's email (the same value used everywhere else as the WDK `userId`/wallet id). `WDK_APP_NODE_JWT_SECRET` must match `infra/wdk-stack/.env`'s `JWT_SECRET` exactly, or app-node will reject every token this backend mints.

## Environment variables

Copy `.env.example` to `.env.local` and fill in all values before starting.

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/cashback_db

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXX
COGNITO_REGION=us-east-1

# Ethereum Sepolia (used to sign/send the UTL cashback payout — not for payment detection)
ETHEREUM_RPC_URL=https://rpc.sepolia.org

# Token contracts
USDT_CONTRACT_ADDRESS=0x...
UTL_CONTRACT_ADDRESS=0x...

# Treasury wallet that sends UTL cashback
TREASURY_PRIVATE_KEY=0x...

# Comma-separated list of merchant addresses to watch
MERCHANT_ADDRESSES=0xabc...,0xdef...

# Redis (Bull queue backend for the transfer-processing pipeline — separate from the WDK event bus below)
REDIS_HOST=localhost
REDIS_PORT=6379

# WDK self-hosted event bus (Redis) — the indexer layer of infra/wdk-stack publishes raw
# transfers here. A different Redis instance than the Bull backing store above.
WDK_EVENT_BUS_REDIS_HOST=localhost
WDK_EVENT_BUS_REDIS_PORT=6380
WDK_EVENT_BUS_REDIS_PASSWORD=
WDK_EVENT_BUS_REDIS_TLS=false
WDK_EVENT_BUS_STREAM_KEY=@wdk/grouped-transactions:ethereum:usdt
WDK_EVENT_BUS_CONSUMER_GROUP=cashback-backend

# Indexer transport selector — 'redis-stream' (default, self-hosted) or 'hosted-api' (legacy
# rollback fallback). Remove this flag once the self-hosted cutover is verified stable.
INDEXER_TRANSPORT=redis-stream

# DEPRECATED — only consulted when INDEXER_TRANSPORT=hosted-api. WDK Indexer API, hosted at
# wdk-api.tether.io (free API key at docs.wdk.tether.io/tools/indexer-api/get-started)
WDK_INDEXER_BASE_URL=https://wdk-api.tether.io
WDK_INDEXER_API_KEY=

# App-node auth bridge — must match infra/wdk-stack/.env's JWT_SECRET exactly, or every token
# this backend mints will be rejected by app-node.
WDK_APP_NODE_JWT_SECRET=
WDK_APP_NODE_TOKEN_TTL_SECONDS=3600
```

## Smart contracts

The UTL ERC-20 token contract lives in `contracts/UTL.sol` and is managed via Hardhat 2.28.

```bash
# Compile
npx hardhat compile

# Deploy to local Hardhat network (for testing)
npx hardhat run scripts/deploy-utl.ts

# Deploy to Sepolia (requires ETHEREUM_RPC_URL + TREASURY_PRIVATE_KEY in env)
npx hardhat run scripts/deploy-utl.ts --network sepolia
```

After Sepolia deploy, copy the printed address into `.env.local` as `UTL_CONTRACT_ADDRESS`.

### Test USDT (for infra/wdk-stack verification, not the cashback loop)

`contracts/TestUSDT.sol` is a disposable, open-mint ERC-20 (6 decimals, anyone can call `mint()`)
used only to stand in for USDT on chains/testnets with no usable canonical test-USDT token —
e.g. Tron's Nile testnet, whose TVM accepts unmodified EVM bytecode, reuses this same contract
(see [`infra/wdk-stack/README.md`](../../infra/wdk-stack/README.md)). It's not part of the
cashback loop and not meant to be reused for anything real.

```bash
# Deploy (any Hardhat network, e.g. --network sepolia)
npx hardhat run scripts/deploy-test-usdt.ts --network sepolia
# → prints the deployed address; set infra/wdk-stack/.env's USDT_ETH_CONTRACT_OVERRIDE (or the
#   relevant chain's contract env var) to it

# Mint test tokens to an address
TEST_USDT_ADDRESS=0x... MINT_TO=0x... npx hardhat run scripts/mint-test-usdt.ts --network sepolia
```

The `contracts/`, `artifacts/`, `cache/`, and `typechain-types/` directories are excluded from the NestJS build via `tsconfig.build.json`.

## Database setup

Schema is defined entirely in code via Mongoose schemas (`src/**/entities/*.ts`) — there is no separate migration step. Indexes (including the unique indexes on `coupons.code`/`coupons.txHash` and the partial unique index on `users.walletAddress`) are created automatically on first connection (`autoIndex: true`, Mongoose's default).

## Running

```bash
# Install (run `pnpm install` from the repo root instead if you also need
# apps/rn-wdk-exercise — this app no longer needs a standalone install)
pnpm install --ignore-workspace

# Development (watch mode)
pnpm start:dev

# Production
pnpm build && pnpm start
```

## Docker Quick Start

> Prerequisites: Docker ≥ 24 and Docker Compose v2.

```bash
# 1. Copy env file and fill in all values
cp .env.example .env.local

# 2. Build images and start API + MongoDB + Redis
docker compose up --build

# 3. Tail API logs
docker compose logs -f api

# 4. Stop (keeps the mongo volume)
docker compose down

# 5. Full teardown including the mongo volume
docker compose down -v
```

The `api` service binds to `http://localhost:3000` (Swagger at `/api/docs`).
The `mongo` service binds to `localhost:27017`.
The `redis` service binds to `localhost:6379`.

## Tests

```bash
pnpm test                # run all unit tests
pnpm test:coverage       # with coverage report
pnpm test:e2e            # hermetic end-to-end suite (test/*.e2e-spec.ts)
pnpm lint                # ESLint
```

128 unit tests across all service, controller, and indexer-pipeline layers, plus 12 end-to-end
tests (`test/wallets.e2e-spec.ts`, `coupons.e2e-spec.ts`, `cashback-flow.e2e-spec.ts`,
`wdk-app-node.e2e-spec.ts`) covering the real HTTP layer against an in-memory MongoDB
(`test/support/mongo-memory.ts`) and a mocked ethers provider (`test/support/ethers-mock.ts`) —
no real network or blockchain calls. This is the suite CI runs (`.github/workflows/ci.yml`).

A separate Artillery load-testing suite (`pnpm test:load`) exists for manual runs against a real
running stack — see [`loadtest/README.md`](loadtest/README.md); it's not wired into CI.

## Module dependency graph

```
AuthModule ─────────────────────────────────── (global JWT guard)
UsersModule ──────────────────────────────────
WalletsModule    → AuthModule, UsersModule
CouponsModule    → AuthModule, UsersModule
IndexerModule    → UsersModule, WdkEventBusModule, WdkModule, BullModule('transfers')
                   (TransferStreamPort selects RedisStreamTransferAdapter or WdkIndexerTransferAdapter
                   via INDEXER_TRANSPORT; writes Coupon rows via TransferProcessor)
WdkEventBusModule → self-hosted WDK stack's Redis event bus (infra/wdk-stack)
WdkModule        → hosted WDK Indexer REST client (wdk-api.tether.io) — deprecated fallback only
WdkAppNodeModule → AuthModule (mints app-node JWTs for the mobile app; see App-node auth bridge)
```
