#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-indexer-wrk-spark (proc or api role depending on WORKER_TYPE).
// See docs/wdk-self-hosted-stack/02-multi-chain-expansion.md §4.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = process.env.MONGO_PORT || '27017'
const mongoDatabase = process.env.INDEXER_MONGO_DATABASE || 'wdk_indexer_spark_btc'

patchJson('config/common.json', (json) => {
  json.dbEngine = 'mongodb' // default is 'hyperdb'
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
  // Spark runs on mainnet now (a project requirement, like Bitcoin) — 'MAINNET' is already the
  // shipped default, so no override needed. NOTE: this field only feeds verifySignature() in
  // chain.spark.client.js — the actual sync/block-iteration path (providers/spark.js) hardcodes
  // 'MAINNET' in its SparkScan query params regardless of this config, a real upstream bug. It's
  // harmless now that we want mainnet anyway, but would silently block a future REGTEST attempt.
})

patchJson('config/facs/redis.config.json', (json) => {
  json.r0.host = process.env.REDIS_HOST || 'redis'
  json.r0.port = Number(process.env.REDIS_PORT || 6379)
})

patchJson('config/facs/db-mongo.config.json', (json) => {
  json.m0.uri = `mongodb://${mongoHost}:${mongoPort}/${mongoDatabase}`
  json.m0.database = mongoDatabase
})

// --chain spark selects config/spark.json. apiKey is sent unconditionally as a Bearer token by
// SparkClient but is NOT checked at boot — an empty/missing key surfaces as a 401 on the first
// real HTTP call, not a crash. Left un-required deliberately so this container boots even before
// the manual SparkScan API key prerequisite is obtained (see doc 02 §5/§6).
patchJson('config/spark.json', (json) => {
  json.apiKey = process.env.SPARK_API_KEY || ''
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('CHAIN', '--chain'), // "spark" — selects config/spark.json
  ...optional('PROC_RPC', '--proc-rpc'),
  ...optional('SYNC_START', '--sync-start'),
  ...optional('SYNC_END', '--sync-end'),
]

spawnWorker(argv)
