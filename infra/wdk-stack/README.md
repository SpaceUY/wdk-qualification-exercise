# WDK Self-Hosted Stack — Core Pipeline (Sub-Project A)

Single-chain (Ethereum Sepolia / USDT) docker-compose stack proving the full self-hosted WDK
pipeline end-to-end: indexer → transaction router → data shard → ork → app-node. See
`docs/wdk-self-hosted-stack/01-core-pipeline.md` in the repo root for the full design rationale.

## Prerequisites

- Docker with BuildKit (`DOCKER_BUILDKIT=1`, on by default in recent Docker Desktop/Engine)
- SSH access to the `SpaceUY` GitHub org (to clone the forked repos)
- A GitHub Personal Access Token with read access to the private `tetherto`/`bitfinexcom`
  package repos referenced in each fork's `package.json` (needed at `docker compose build` time)
- A Sepolia RPC URL (a free public endpoint works, e.g. `https://ethereum-sepolia.publicnode.com`)

## Setup

```bash
cd infra/wdk-stack
cp .env.example .env          # if not already done
./scripts/gen-secrets.sh      # fills WDK_CAPABILITY / WDK_CRYPTO_KEY / JWT_SECRET
./scripts/clone-forks.sh      # vendors the 5 forked repos into ./vendor (gitignored)
```

Edit `.env` and fill in:
- `GITHUB_PAT` — required for `docker compose build` (private npm deps)
- `SEPOLIA_RPC_URL` — override if you have your own Infura/Alchemy key

## Two-phase bring-up

The indexer's and data-shard's `api` (read-replica) roles need the RPC public key their `proc`
sibling prints on boot — a fresh keypair identity each time unless `store/` is persisted (it is,
via named volumes, so the key is stable across restarts once generated).

```bash
# Phase 1 — boot the two proc/writer services first
DOCKER_BUILDKIT=1 docker compose build --secret id=PAT_TOKEN,env=GITHUB_PAT
docker compose up -d indexer-evm-proc data-shard-proc

# Grab the printed RPC public keys
docker compose logs indexer-evm-proc | grep -i "rpc public key"
docker compose logs data-shard-proc | grep -i "rpc public key"

# Paste them into .env
#   INDEXER_PROC_RPC_KEY=<key from indexer-evm-proc>
#   DATA_SHARD_PROC_RPC_KEY=<key from data-shard-proc>

# Phase 2 — boot everything else
docker compose up -d
```

Hyperswarm peer discovery (ork ↔ data-shard, app-node ↔ ork) runs over the **public** Hyperswarm
DHT — no private bootstrap node is configured (confirmed: every service's
`config/facs/net.config.json.example` is an empty `{"r0": {}}`). First-boot discovery can take
10–60 seconds; this is expected, not a failure.

### ORK replica

`ork-2` is a secondary ORK instance (same `wdk_lookup` Mongo DB, same capability/crypto key as
`ork`), started with `SECONDARY=true`. This matters because the mongodb lookup engine infers
master/secondary purely from the `--secondary` CLI flag, not config — a node started without it
always runs as master, and two masters would double-run the Sunday inactive-user cleanup cron.
`app-node` discovers both automatically over the shared `orkTopic` (no config on its side), load
balances per-user via a CRC32 hash, and fails over to the other ork on a closed RPC channel for
idempotent reads. Confirm both are up and discovered via `curl localhost:3000/api/v1/ready` — a
healthy pair reports `"orks":2`.

`app-node` itself stays a single instance bound directly to host port 3000 — a local nginx
load-balancer sidecar was tried and verified working, then deliberately removed: the confirmed
production target for this project is AWS Elastic Beanstalk, which provisions its own load
balancer (ELB/ALB) in front of horizontally-scaled EC2 instances automatically, so a local nginx
stand-in isn't worth building/maintaining twice. See `docs/qualification-todo.md`.

## Verification

Follow `docs/wdk-self-hosted-stack/01-core-pipeline.md` §6 in full. Short version:

1. `docker compose ps` — all 8 containers `Up`/healthy.
2. `docker compose exec redis redis-cli --scan --pattern '@wdk/grouped-transactions:*'` — confirm
   the stream is literally `@wdk/grouped-transactions:sepolia:usdt`.
3. Register a wallet via `wdk-app-node` (`POST /connect`, `POST /wallets`) for
   `chain: "sepolia", ccy: "usdt"`.
4. Send a small real USDT transfer on Sepolia to the registered address.
5. Trace it through: indexer logs → Redis stream → processor logs → `mongo` shard collection.
6. `GET /balance` / `GET /wallets/:id/token-transfers` on `wdk-app-node` (port 3000) — a correct
   response here (the balance call exercises a **live** on-chain RPC round-trip through
   `indexer-evm-api`) is the definition of done.

## Notes

- `vendor/` and `.env` are gitignored — nothing under this directory beyond the compose file,
  Dockerfiles, entrypoints, and scripts is meant to be committed.
- This directory itself is a local/dev stack only. Production AWS deployment now has a concrete
  plan — see [`docs/deployment-guide.md`](../../docs/deployment-guide.md#13-elastic-beanstalk--infrawdk-stack):
  Elastic Beanstalk (same target as `apps/backend`), single-instance (not horizontally scaled,
  since `mongo`/`redis`/`ork` are stateful), with images pre-built and pushed to ECR since the EB
  instance itself can't clone the private forked repos the way `clone-forks.sh` does locally.
- `redis` (6380) and `mongo` (27018) are both mapped to host ports for external debugging
  (mongosh/Compass, redis-cli) — separate from `apps/backend/docker-compose.yml`'s own
  Mongo/Redis, which store application data (users/wallets/coupons + Bull queue), not
  WDK-internal indexer state. Mixing the two would be worse practice, not a gap.
## Sub-project B — Bitcoin, Spark, Tron (USDT-TRC20)

Adds three more chains on top of the core pipeline above. See
`docs/wdk-self-hosted-stack/02-multi-chain-expansion.md` for the full design and reconciliation
notes (in particular: why the three new indexer Dockerfiles use SSH-agent forwarding with no
`PAT_TOKEN`, unlike the processor/data-shard/ork/app-node images).

### Additional prerequisites

- A Bitcoin **mainnet** RPC provider key (`BTC_MAINNET_RPC_URL` in `.env`) — Bitcoin runs on
  mainnet, not testnet, per an explicit project requirement (real funds). A Blockbook secondary
  (`blockbook.btc.zelcore.io`) is baked into the entrypoint as a fallback for balance queries the
  primary RPC provider rejects (e.g. Alchemy's `scantxoutset`).
- A SparkScan API key (`SPARK_API_KEY`) — required to actually index anything (the indexer boots
  without one and only 401s on real requests). Spark also runs on **mainnet** (it's a Bitcoin L2,
  so it carries the same real-funds requirement as Bitcoin) — the same key works for both mainnet
  and regtest, only the `?network=` query param differs. Note: the vendored
  `wdk-indexer-wrk-spark` package has a real upstream bug — it hardcodes `network: 'MAINNET'` in
  its actual sync path (`providers/spark.js`) regardless of `config/common.json`'s `sparkNetwork`
  setting (that field only feeds an unrelated `verifySignature()` method). Harmless now that
  mainnet is what we want, but would silently block a future REGTEST attempt.
- A Nile TRC20 USDT test-token contract address (`TRON_USDT_CONTRACT`) — no usable canonical one
  exists on Nile (the official faucet's own "test USDT" token can't be minted without owner
  access, and pasting the wrong recipient into the faucet silently returns tokens to the
  contract's own balance with no error). Deploy a disposable ERC20-compatible contract instead —
  TVM accepts unmodified EVM bytecode (see `apps/backend/contracts/TestUSDT.sol`, reused as-is for
  this). `TRON_RPC_URL` already defaults to the public, keyless Nile endpoint.

### Bring-up

**If you already have sub-project A running**: `data-shard`, `ork`, and `app-node`'s entrypoint
scripts were patched (BTC testnet address regex, `app-node`'s missing `tron` entry) — those
patches are baked into the image at build time, so their existing images must be rebuilt or the
fixes silently won't take effect:

```bash
docker compose build data-shard-proc data-shard-api ork app-node
docker compose up -d --force-recreate data-shard-proc data-shard-api ork app-node
```

Same two-phase pattern as sub-project A — the three new indexers' `api` roles need their `proc`
sibling's printed RPC public key:

```bash
docker compose build indexer-btc-proc indexer-btc-api processor-bitcoin \
                      indexer-spark-proc indexer-spark-api processor-spark \
                      indexer-tron-proc indexer-tron-api processor-tron
docker compose up -d indexer-btc-proc indexer-spark-proc indexer-tron-proc

docker compose logs indexer-btc-proc indexer-spark-proc indexer-tron-proc | grep -i "rpc public key"
# paste into .env: INDEXER_BTC_PROC_RPC_KEY / INDEXER_SPARK_PROC_RPC_KEY / INDEXER_TRON_PROC_RPC_KEY

docker compose up -d
```

### Verification tiers (see doc 02 §6 and `docs/qualification-todo.md` for the full detail)

- **BTC** — fully verified end-to-end on **mainnet**: sent a real BTC transfer via MetaMask to an
  RN-app-generated address, confirmed it flowed through `indexer-btc-proc` → Redis stream →
  `processor-bitcoin` → `data-shard`, and that `GET /balance` / `GET /wallets/:id/token-transfers`
  return correct results. Requires registering the address as a wallet via `app-node` first
  (`POST /connect` then `POST /wallets`) — the RN app doesn't do this on its own.
- **Tron** — fully verified end-to-end on Nile testnet using the disposable deployed TRC20
  contract described above. The RN app itself can't exercise this chain yet — see the RN app
  README's Tron address-validation bug note.
- **Spark** — plumbing verified on **mainnet** (API key confirmed working, a real address
  registered as a wallet via `app-node`), but fund-flow is **not verified**: crediting real BTC
  into a Spark wallet requires a separate deposit-address + confirmation + explicit-claim flow
  (`getStaticDepositAddress()` / `claimStaticDeposit()`) with no UI anywhere in the RN app —
  confirmed out of scope for this project, not something to build now.

## Sub-project D — Backend integration

`apps/backend`'s cashback listener can read directly from this stack's Redis event bus instead of
the hosted WDK Indexer API, via the `INDEXER_TRANSPORT=redis-stream` feature flag (default; set to
`hosted-api` to fall back to the old path instantly). See
[`apps/backend/README.md`](../../apps/backend/README.md#transfer-indexing-pipeline) for the
adapter details, and `docs/wdk-self-hosted-stack/03-backend-integration.md` for the design
rationale. In short: the backend runs its own consumer group on the same
`@wdk/grouped-transactions:<chain>:<token>` stream that `indexer-processor` consumes — since
`indexer-processor` `XDEL`s every message right after processing (removing it for all consumer
groups, not just its own), the backend's listener has to block on `XREADGROUP` continuously rather
than poll on a timer, or it will lose the race almost every time.
