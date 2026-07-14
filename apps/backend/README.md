# Backend — Cashback API

NestJS REST API that powers the P2P retail cashback loop. It detects USDT payments to merchant addresses on Ethereum Sepolia via the hosted WDK Indexer API, generates 5% cashback coupons, and redeems them by transferring UTL tokens from a treasury wallet.

## Architecture

```
src/
├── config/            # Namespaced ConfigModule factories (cognito, database, blockchain, redis, wdkIndexer, wdkAppNode, prices)
├── auth/               # Cognito RS256 JWT guard via jwks-rsa + passport-jwt
├── users/              # User registry (cognitoSub + email + walletAddress)
├── wallets/            # Encrypted seed backup + wallet address registration
├── coupons/            # Coupon lifecycle: creation by the indexer processor, redemption via UTL transfer
├── modules/indexer/    # Transfer detection → Bull queue → coupon-creation pipeline (port/adapter/consumer/processor);
│                       # pluggable transport — self-hosted WDK Redis stream (default) or hosted WDK Indexer API (legacy fallback)
├── wdk/                # HTTP client for the hosted WDK Indexer API (wdk-api.tether.io)
├── wdk-app-node/       # Mints short-lived JWTs for app-node's own REST API, and proxies its token-transfers endpoint
├── prices/             # USD spot price + history proxy over CoinGecko — public, no auth
├── merchants/          # Affiliated merchant addresses/names + cashback rate — public, no auth
└── health/             # Liveness check for the load balancer — public, no auth
```

**Stack:** NestJS 10 · Mongoose · MongoDB · Redis + Bull · ethers v6 · AWS Cognito (RS256 JWTs) · `@nestjs/schedule` · `@nestjs/swagger`

## API docs

Interactive Swagger UI is served at `/api/docs` (JSON at `/api/docs-json`) whenever `NODE_ENV !== 'production'`. Use the "Authorize" button with a Cognito `id` token to try authenticated routes directly.

## API endpoints

Endpoints marked **public** require no auth. All others require a Cognito `id` token in the `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/coupons` | List the authenticated user's unredeemed cashback coupons |
| `GET` | `/coupons/claimed` | List the authenticated user's redeemed cashback coupons |
| `POST` | `/coupons/claim` | Redeem a cashback coupon — transfers UTL tokens to the user's wallet |
| `POST` | `/wallets/backup` | Upsert encrypted seed ciphertext for the authenticated user |
| `GET` | `/wallets/backup/exists` | Check whether the authenticated user already has a cloud wallet backup |
| `PUT` | `/wallets/address` | Register or update the user's EVM wallet address |
| `GET` | `/wdk-app-node/token` | Mint a short-lived JWT for the self-hosted WDK stack's app-node API (see below) |
| `GET` | `/wdk-app-node/token-transfers` | Proxy app-node's transaction history for the authenticated user, with retry + Redis fallback cache (see below) |
| `GET` | `/prices` | **Public.** USD spot prices + 24h change for the assets the wallet displays |
| `GET` | `/prices/history/:symbol` | **Public.** USD price series for one asset (`?range=1d\|1w\|1m\|1y`) |
| `GET` | `/merchants` | **Public.** Affiliated merchant addresses, display names, and the current cashback rate |
| `GET` | `/health` | **Public.** Liveness check for the load balancer |

### `GET /coupons`

```json
// Response 200
[
  {
    "id": "<uuid>",
    "code": "<32-char hex>",
    "usdtAmountRaw": "1000000",
    "utlAmountRaw": "50000000000000000",
    "merchantAddress": "0xabc...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

`merchantAddress` (the EVM address that received the original USDT payment) is `null` for coupons created before this field existed in the schema.

### `GET /coupons/claimed`

```json
// Response 200
[
  {
    "id": "<uuid>",
    "usdtAmountRaw": "1000000",
    "utlAmountRaw": "50000000000000000",
    "merchantAddress": "0xabc...",
    "redeemedAt": "2024-01-01T00:00:00.000Z",
    "redemptionTxHash": "0x...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `POST /coupons/claim`

```json
// Request
{ "code": "<32-char hex coupon code>" }

// Response 201
{ "redemptionTxHash": "0x..." }
```

### `POST /wallets/backup`

```json
// Request
{ "ciphertext": "<base64-encoded AES-GCM blob>" }

// Response 201
{ "id": "<backup-uuid>" }
```

`ciphertext` is checked by a custom class-validator constraint, `IsWdkBackupCiphertextConstraint`
(`src/wallets/dto/is-wdk-backup-ciphertext.validator.ts`) — it verifies the blob's shape (base64-decoded
length ≥ version + 16-byte salt + 12-byte IV + 16-byte GCM tag) and that the version byte falls in a
deliberately wide range (`0x01`–`0x0f`, not an exact allowlist) but never decrypts it; the passphrase
never leaves the client. An exact allowlist would need redeploying in lockstep with every KDF change in
the mobile app's own versioned scheme (`apps/rn-wdk-exercise/utils/seedEncryption.ts`'s
`SCRYPT_PARAMS_BY_VERSION`) — a sync that already broke once in production (the app shipped a new
version byte while this validator's list still only recognized the old ones, turning every backup
upload into a 400). The client itself still rejects unknown versions on restore via its own table.

### `GET /wallets/backup/exists`

```json
// Response 200
{ "exists": true }
```

Read-only — looks up the user by Cognito `sub` without creating a row, so calling it never has the
side effect of registering a new user (unlike the other endpoints, which upsert on first call).

### `PUT /wallets/address`

```json
// Request
{ "walletAddress": "0xabc..." }

// Response 200
{ "walletAddress": "0xabc..." }
```

### `GET /wdk-app-node/token-transfers`

```json
// Response 200
{
  "transfers": [
    {
      "transactionHash": "0x...",
      "blockchain": "ethereum",
      "token": "usdt",
      "from": "0x...",
      "to": "0x...",
      "amount": "1000000",
      "ts": 1700000000000,
      "type": "received"
    }
  ]
}
```

Query params: `limit` (default 25), `skip` (default 0). See [App-node integration](#app-node-integration) below.

### `GET /prices`

```json
// Response 200
{
  "prices": { "ETH": 2500.12, "BTC": 65000.5, "sBTC": 65000.5, "USDT": 1.0, "UTL": null },
  "changePct24h": { "ETH": 1.23, "BTC": -0.45, "sBTC": -0.45, "USDT": 0.01, "UTL": null },
  "fetchedAt": "2024-01-01T00:00:00.000Z"
}
```

`null` means the asset has no market price (UTL) — clients must render "no data", never `$0`. Public, no auth. Backed by CoinGecko, cached in-process for 60s.

### `GET /prices/history/:symbol`

```json
// Response 200 — GET /prices/history/BTC?range=1w
{
  "symbol": "BTC",
  "range": "1w",
  "points": [{ "timestamp": 1700000000000, "price": 65000.5 }],
  "fetchedAt": "2024-01-01T00:00:00.000Z"
}
```

`range` is one of `1d` | `1w` | `1m` | `1y` (default `1d`). `points` is chronological, capped at 300 points (CoinGecko's raw series is downsampled). Empty `points` means the asset has no market (UTL). Public, no auth; 404 on an unknown symbol.

### `GET /merchants`

```json
// Response 200
{
  "addresses": ["0xcafdb270dcfddc9dede4d444c955618c0ff05cff"],
  "names": { "0xcafdb270dcfddc9dede4d444c955618c0ff05cff": "Test Merchant" },
  "cashbackRate": 0.05
}
```

`addresses` mirrors `MERCHANT_ADDRESSES` (the cashback pipeline's source of truth); `names` is
display-only metadata (`src/config/merchants.config.ts`) and an address missing from it is still a
valid merchant, just shown with a generic name client-side. `cashbackRate` is `cashbackBps / 10000`
(currently hardcoded to 500 bps / 5% in `src/config/blockchain.config.ts`, not env-configurable).
Public, no auth.

### `GET /health`

```json
// Response 200
{ "status": "ok" }
```

Public, no auth — liveness check for the load balancer.

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

## App-node integration

The mobile app talks to the self-hosted WDK stack's `app-node` REST API (`infra/wdk-stack`) for wallet registration and transaction history — a separate concern from this backend's own cashback API, using app-node's own auth scheme (HS256 JWT, payload `{ userId }`, verified against a shared secret) rather than Cognito. This backend bridges the two in two different ways:

### `GET /wdk-app-node/token` — direct auth bridge

Wallet registration (`POST /connect`, `POST`/`PATCH /wallets`) is still called directly by the mobile app against app-node. Since app-node's shared secret can't be trusted to the client, `WdkAppNodeService.mintToken()` signs a short-lived token server-side (this endpoint is Cognito-guarded like everything else), scoped to the authenticated user's email (the same value used everywhere else as the WDK `userId`/wallet id). `WDK_APP_NODE_JWT_SECRET` must match `infra/wdk-stack/.env`'s `JWT_SECRET` exactly, or app-node will reject every token this backend mints.

### `GET /wdk-app-node/token-transfers` — server-side proxy

Transaction history is **not** fetched directly from app-node by the mobile app. app-node's ork/DHT shard lookup is unreliable and can fail for minutes at a stretch, so `TokenTransfersService` (`src/wdk-app-node/token-transfers.service.ts`) proxies it server-side: it calls app-node's own `GET /api/v1/users/:userId/token-transfers` (minting its own token internally via `WdkAppNodeService`), retries twice with a short backoff (300ms/800ms) on failure, and on success caches the result in Redis for `WDK_APP_NODE_TOKEN_TRANSFERS_CACHE_TTL_SECONDS` (default 24h). If the live call still fails after retries, it serves the last cached value instead of erroring; only with no cache at all does it return a 503. `WDK_APP_NODE_BASE_URL` is where this backend reaches app-node (server-side network path, not necessarily the same as the mobile app's `EXPO_PUBLIC_APP_NODE_URL`).

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

# Where this backend reaches app-node server-side to proxy GET /wdk-app-node/token-transfers
# (see App-node integration above). Not necessarily the same network path as the mobile
# app's own EXPO_PUBLIC_APP_NODE_URL.
WDK_APP_NODE_BASE_URL=http://localhost:3000
WDK_APP_NODE_TOKEN_TRANSFERS_CACHE_TTL_SECONDS=86400

# Optional CoinGecko demo/pro API key for GET /prices and /prices/history/:symbol — raises the
# rate limit; empty means anonymous access (default CoinGecko base URL, in-process 60s cache).
COINGECKO_API_KEY=
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

166 unit tests across all service, controller, and indexer-pipeline layers, plus 12 end-to-end
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
WdkAppNodeModule → AuthModule (mints app-node JWTs + proxies token-transfers; see App-node integration)
PricesModule     → CoinGecko REST client — public, no auth
MerchantsModule  → reads blockchain.merchantAddresses config — public, no auth
HealthModule     → no dependencies — public, no auth
```
