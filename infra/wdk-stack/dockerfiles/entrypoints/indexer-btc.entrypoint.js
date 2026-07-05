#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-indexer-wrk-btc (proc or api role depending on WORKER_TYPE).
// Same render-config pattern as indexer-evm.entrypoint.js — see
// docs/wdk-self-hosted-stack/02-multi-chain-expansion.md §4.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = process.env.MONGO_PORT || '27017'
const mongoDatabase = process.env.INDEXER_MONGO_DATABASE || 'wdk_indexer_bitcoin_btc'

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

// --chain bitcoin selects config/bitcoin.json. BTC runs on mainnet (a project requirement,
// unlike the other chains in this stack which stay on testnet) — no default mainnet-capable
// RPC ships upstream, BTC_RPC_URL is a hard external prerequisite. See doc 02 §5.
patchJson('config/bitcoin.json', (json) => {
  json.network = 'mainnet'
  json.mainRpc.uri = required('BTC_RPC_URL')
  // Alchemy (our mainRpc) rejects `scantxoutset` ("Unsupported method: scantxoutset on
  // BITCOIN_MAINNET") — RpcProvider.getBalance() needs it, breaking live balance lookups,
  // even though block/tx sync (getBlockIterator/getTransaction) works fine without it.
  // RpcBaseManager.callWithFailover() catches ANY primary error and retries via a secondary
  // (verified: it's a catch-all, not filtered by error type), so a single Blockbook-type
  // secondary here fixes getBalance without touching the main provider. This is a REAL
  // populated secondary, not the `[]`-breaks-failover trap noted in indexer-evm.entrypoint.js
  // (that trap only applies to an empty array). blockbook.btc.zelcore.io is a public,
  // unauthenticated, in-sync mainnet Blockbook instance, verified live via curl — unlike
  // btc1.trezor.io (used by apps/rn-wdk-exercise's own wallet client), which Cloudflare
  // blocks entirely for API-shaped requests regardless of URL path.
  json.secondaryRpcs = [{
    name: 'zelcore-blockbook',
    type: 'blockbook',
    uri: 'https://blockbook.btc.zelcore.io/api',
    blockbookUri: 'https://blockbook.btc.zelcore.io/api',
    weight: 1
  }]
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('CHAIN', '--chain'), // "bitcoin" — selects config/bitcoin.json
  ...optional('PROC_RPC', '--proc-rpc'),
  ...optional('SYNC_START', '--sync-start'),
  ...optional('SYNC_END', '--sync-end'),
]

spawnWorker(argv)
