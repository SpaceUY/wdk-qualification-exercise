# Backend — Cashback API

NestJS REST API that powers the P2P retail cashback loop. It monitors Ethereum Sepolia for USDT payments to merchant addresses, generates 5% cashback coupons, and redeems them by transferring UTL tokens from a treasury wallet.

## Architecture

```
src/
├── config/           # Namespaced ConfigModule factories (cognito, database, blockchain)
├── auth/             # Cognito RS256 JWT guard via jwks-rsa + passport-jwt
├── users/            # User registry (cognitoSub + email + walletAddress)
├── wallets/          # Encrypted seed backup + wallet address registration
├── coupons/          # Coupon lifecycle: creation by listener, redemption via UTL transfer
├── listener/         # Blockchain event watcher (WebSocket + polling fallback)
└── wdk/              # HTTP wrapper for the WDK App Layer REST API
```

**Stack:** NestJS 10 · TypeORM · PostgreSQL · ethers v6 · AWS Cognito (RS256 JWTs) · `@nestjs/schedule`

## API endpoints

All endpoints require a Cognito `id` token in the `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/coupons` | List the authenticated user's unredeemed cashback coupons |
| `GET` | `/coupons/claimed` | List the authenticated user's redeemed cashback coupons |
| `POST` | `/wallets/backup` | Upsert encrypted seed ciphertext for the authenticated user |
| `PUT` | `/wallets/address` | Register or update the user's EVM wallet address |
| `POST` | `/coupons/claim` | Redeem a cashback coupon — transfers UTL tokens to the user's wallet |

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

## Blockchain listener

The `ListenerService` uses a hybrid strategy for zero-drop event detection:

- **WebSocket (primary):** Subscribes to `Transfer(address,address,uint256)` events on the USDT contract in real time via `ethers.WebSocketProvider`. Reconnects automatically on disconnect (5 s backoff).
- **HTTP polling (fallback):** A `@Cron('*/30 * * * * *')` job calls `eth_getLogs` from `lastProcessedBlock + 1` to `currentBlock - 2` every 30 seconds, catching any events missed during WS gaps.
- **Crash recovery:** `last_processed_block` is persisted in the `listener_states` table. On restart the poller resumes from the last confirmed block.
- **Idempotency:** `coupons.tx_hash` has a `UNIQUE` constraint. Duplicate inserts (e.g. WS + poll both fire) silently discard the second attempt (Postgres error `23505`).

### Cashback math

```
UTL raw = USDT raw × 500 / 10000 × 10^12
```

The `10^12` factor adjusts for the decimal difference between USDT (6 decimals) and UTL (18 decimals). Example: 1 USDT → 0.05 UTL.

## Environment variables

Copy `.env.example` to `.env.local` and fill in all values before starting.

```env
# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=secret
DATABASE_NAME=cashback

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXX
COGNITO_REGION=us-east-1

# Ethereum Sepolia
ETHEREUM_RPC_URL=https://rpc.sepolia.org
ETHEREUM_WSS_URL=wss://...          # optional — enables WebSocket listener

# Token contracts
USDT_CONTRACT_ADDRESS=0x...
UTL_CONTRACT_ADDRESS=0x...

# Treasury wallet that sends UTL cashback
TREASURY_PRIVATE_KEY=0x...

# Comma-separated list of merchant addresses to watch
MERCHANT_ADDRESSES=0xabc...,0xdef...

# WDK App Layer base URL
WDK_BASE_URL=http://localhost:4000
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

The `contracts/`, `artifacts/`, `cache/`, and `typechain-types/` directories are excluded from the NestJS build via `tsconfig.build.json`.

## Database setup

Migrations are managed via the TypeORM CLI. `synchronize` is disabled in production.

```bash
# Generate a migration after entity changes
pnpm typeorm migration:generate src/migrations/InitSchema -- -d src/data-source.ts

# Run pending migrations
pnpm typeorm migration:run -- -d src/data-source.ts
```

## Running

```bash
# Install (run from this directory — monorepo root install fails due to RN peer deps)
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

# 2. Build images and start API + Postgres
docker compose up --build

# 3. In a separate terminal — run migrations
docker compose exec api node -e \
  "require('./dist/data-source').AppDataSource.initialize().then(ds => ds.runMigrations()).then(() => process.exit(0))"

# 4. Tail API logs
docker compose logs -f api

# 5. Stop (keeps postgres volume)
docker compose down

# 6. Full teardown including the postgres volume
docker compose down -v
```

The `api` service binds to `http://localhost:3000`.
The `db` service binds to `localhost:5432`.

## Tests

```bash
pnpm test                # run all unit tests
pnpm test:coverage       # with coverage report
pnpm lint                # ESLint
```

40 unit tests across all service and controller layers. Service coverage ≥ 90%.

## Module dependency graph

```
AuthModule ─────────────────────────────────── (global JWT guard)
UsersModule ──────────────────────────────────
WalletsModule    → AuthModule, UsersModule
CouponsModule    → AuthModule, UsersModule
ListenerModule   → UsersModule               (writes Coupon rows directly)
WdkModule        → standalone axios client
```
