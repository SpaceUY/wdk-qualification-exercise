#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-data-shard-wrk (proc=writer or api=read-replica,
// depending on WORKER_TYPE). `m0` is this shard's own data DB; `mlookup` MUST point at
// the same shared `wdk_lookup` DB that wdk-ork-wrk and wdk-indexer-processor-wrk's `m0`
// use — see docs/wdk-self-hosted-stack/01-core-pipeline.md finding #4.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = process.env.MONGO_PORT || '27017'
const shardDatabase = process.env.SHARD_MONGO_DATABASE || 'wdk_shard_1'
const lookupDatabase = process.env.LOOKUP_MONGO_DATABASE || 'wdk_lookup'

patchJson('config/common.json', (json) => {
  json.dbEngine = 'mongodb' // default is 'hyperdb' — lookupEngine already defaults to 'mongodb' in this repo
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
  // "ethereum" (not "sepolia") is required here — TransferProcessorRouter's CHAIN_PROCESSORS
  // map only recognizes chain-family names (ethereum/bitcoin/tron/etc.), not network names —
  // see the indexer-evm entrypoint's comment for the full explanation. No further patch needed
  // for it; the shipped "ethereum" entry already includes "usdt".
  //
  // bitcoin/spark/tron entries already ship in this repo's example config. BTC runs on
  // mainnet (a project requirement), and the shipped regex is already mainnet-only
  // (^[13]...), so no patch is needed here — see doc 02 §0 finding #2 for the
  // now-reverted testnet-address-regex patch this used to carry.
})

patchJson('config/facs/redis.config.json', (json) => {
  json.r0.host = process.env.REDIS_HOST || 'redis'
  json.r0.port = Number(process.env.REDIS_PORT || 6379)
})

patchJson('config/facs/db-mongo.config.json', (json) => {
  json.m0.uri = `mongodb://${mongoHost}:${mongoPort}/${shardDatabase}`
  json.m0.database = shardDatabase
  json.mlookup.uri = `mongodb://${mongoHost}:${mongoPort}/${lookupDatabase}`
  json.mlookup.database = lookupDatabase
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('PROC_RPC', '--proc-rpc'),
]

spawnWorker(argv)
