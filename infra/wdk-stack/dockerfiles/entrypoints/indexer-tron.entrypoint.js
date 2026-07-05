#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-indexer-wrk-tron, USDT-TRC20 pairing only (--chain usdt-tron,
// wrk-trc20-indexer-proc/api). Native TRX (tron.json, wrk-tron-indexer-proc/api) is out of
// scope — see docs/wdk-self-hosted-stack/02-multi-chain-expansion.md's reconciliation note.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = process.env.MONGO_PORT || '27017'
const mongoDatabase = process.env.INDEXER_MONGO_DATABASE || 'wdk_indexer_tron_usdt'

patchJson('config/common.json', (json) => {
  json.dbEngine = 'mongodb' // default is 'hyperdb'
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

// --chain usdt-tron selects config/usdt-tron.json. TronGrid's Nile testnet needs no API key
// (only mainnet enforces TRON-PRO-API-KEY), so TRON_RPC_URL ships a working public default.
// TRON_USDT_CONTRACT has no safe default — no canonical test-USDT exists on Nile, a real
// contract address must be sourced/deployed (see doc 02 §5).
//
// gasFreeConfig: chain.tron.client.js only runs its 8-key shape check `if (this.gasFreeConfig)`
// — since the shipped example object already has all 8 keys, we only patch the live
// network-identifying fields and leave serviceProvider/verifyingContract/paymasterToken/
// gasFreeApiKey/gasFreeApiSecret at their shipped placeholders. The GasFree receipt-lookup path
// itself is untested in this sub-project (see doc 02 §6).
patchJson('config/usdt-tron.json', (json) => {
  const rpcUrl = process.env.TRON_RPC_URL || 'https://nile.trongrid.io/jsonrpc'
  json.mainRpc.rpcUrl = rpcUrl
  // Shipped defaults point at mainnet trongrid, but setting `[]` (rather than deleting the key)
  // breaks RPC failover — @tetherto/wdk-indexer-wrk-base's RpcBaseManager only self-populates a
  // main-as-fallback secondary when `secondaryRpcs` is `undefined`; an explicit `[]` leaves zero
  // secondaries and crashes on any transient primary failure. See indexer-evm.entrypoint.js for
  // the same fix and full rationale.
  delete json.secondaryRpcs
  json.contract = required('TRON_USDT_CONTRACT')
  json.gasFreeConfig.chainId = 3448148188 // Nile, not mainnet's 728126428
  json.gasFreeConfig.provider = rpcUrl
  json.gasFreeConfig.gasFreeProvider = 'https://open-test.gasfree.io/nile/'
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('CHAIN', '--chain'), // "usdt-tron" — selects config/usdt-tron.json
  ...optional('PROC_RPC', '--proc-rpc'),
  ...optional('SYNC_START', '--sync-start'),
  ...optional('SYNC_END', '--sync-end'),
]

spawnWorker(argv)
