#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-indexer-wrk-evm (USDT-ERC20 worker, proc or api role
// depending on WORKER_TYPE). Patches config/*.json in place (copied from *.example at
// build time by the repo's own setup-config.sh), then execs worker.js the same way
// wdk-indexer-wrk-btc's original entrypoint does.
//
// See docs/wdk-self-hosted-stack/01-core-pipeline.md §3 for the field-by-field rationale.

// NOTE on paths: this file is COPY'd to /app/docker-entrypoint.js and ./entrypoint-lib/ is
// COPY'd alongside it (see the Dockerfiles' `additional_contexts` build step) — __dirname is
// /app at runtime, same as worker.js itself (copied in from the vendored repo's own source).
const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = process.env.MONGO_PORT || '27017'
const mongoDatabase = process.env.INDEXER_MONGO_DATABASE || 'wdk_indexer_ethereum_usdt'

patchJson('config/common.json', (json) => {
  json.dbEngine = 'mongodb' // default is 'hyperdb' — see doc 01 finding #5
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
})

patchJson('config/facs/redis.config.json', (json) => {
  json.r0.host = process.env.REDIS_HOST || 'redis'
  json.r0.port = Number(process.env.REDIS_PORT || 6379)
})

patchJson('config/facs/db-mongo.config.json', (json) => {
  json.m0.uri = `mongodb://${mongoHost}:${mongoPort}/${mongoDatabase}`
  json.m0.database = mongoDatabase
})

// --chain usdt-eth selects config/usdt-eth.json — its internal "chain": "ethereum" field is a
// routing LABEL (must match the family names hardcoded in wdk-data-shard-wrk's
// TransferProcessorRouter: ethereum/bitcoin/tron/etc.), independent of which network the RPC
// actually talks to. We keep "ethereum" as the label but point mainRpc/contract at Sepolia —
// see docs/wdk-self-hosted-stack/01-core-pipeline.md for why "sepolia" as the label breaks
// downstream chain-family dispatch with ERR_NO_TRANSFER_PROCESSOR.
patchJson('config/usdt-eth.json', (json) => {
  const rpcUrl = required('SEPOLIA_RPC_URL')
  json.mainRpc.rpcUrl = rpcUrl
  // Shipped defaults point at mainnet, so we can't keep them — but setting `[]` (rather than
  // deleting the key) is worse: @tetherto/wdk-indexer-wrk-base's RpcBaseManager only
  // self-populates a main-as-fallback secondary when `secondaryRpcs` is `undefined` (via
  // `?? [{instance: this.main, ...}]`); an explicit `[]` bypasses that default and leaves zero
  // secondaries. Any transient primary-RPC failure then hits RpcBaseManager.call()'s
  // useSecondary path, which resolves `this.secondary` to `undefined` on an empty list —
  // surfacing as a confusing `Cannot read properties of undefined (reading 'tokenContract')`
  // in chain.erc20.client.js instead of a clean retry against the same provider. Deleting the
  // key (vs. `[]`) lets the base class's own single-provider fallback apply.
  delete json.secondaryRpcs
  // USDT_ETH_CONTRACT_OVERRIDE lets local verification point at a throwaway self-minted test
  // token instead of Tether's shared Sepolia USDT (which has an owner-gated mint — no public
  // faucet). Unset in normal operation, where the shipped default applies.
  json.contract = process.env.USDT_ETH_CONTRACT_OVERRIDE?.trim() || '0xd077A400968890Eacc75cdc901F0356c943e4fDb'
  json.erc4337WalletConfig.chainId = 11155111 // Sepolia, not mainnet's 1
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('CHAIN', '--chain'), // config file selector, e.g. "usdt-eth" — see note above
  ...optional('PROC_RPC', '--proc-rpc'),
  ...optional('SYNC_START', '--sync-start'),
  ...optional('SYNC_END', '--sync-end'),
]

spawnWorker(argv)
