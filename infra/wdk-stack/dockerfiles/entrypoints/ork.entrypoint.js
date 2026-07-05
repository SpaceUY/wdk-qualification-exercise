#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-ork-wrk (directory/routing layer — one master + N
// secondaries). MongoDB lookup mode, pointed at the shared `wdk_lookup` DB — see
// docs/wdk-self-hosted-stack/01-core-pipeline.md finding #4. A node started without
// SECONDARY=true is the "master" (runs the Sunday cleanup cron) — for this single-node
// core-pipeline PoC there's exactly one ork instance, so it's always master.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional, flag } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = Number(process.env.MONGO_PORT || 27017)
const lookupDatabase = process.env.LOOKUP_MONGO_DATABASE || 'wdk_lookup'

patchJson('config/common.json', (json) => {
  json.lookupEngine = 'mongodb' // default is 'autobase' — see doc 01 finding #5
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
  // "ethereum" (the shipped family key) already includes "usdt" and must stay a family name,
  // not "sepolia" — see data-shard.entrypoint.js's comment.
  //
  // BTC runs on mainnet (a project requirement) — the shipped mainnet regex (^[13]...) is
  // already correct here, no patch needed. See doc 02 §0 finding #2 for the now-reverted
  // testnet-address-regex patch this used to carry.
})

patchJson('config/facs/db-mongo.config.json', (json) => {
  // Set uri directly rather than discrete host/port/database fields — see
  // processor.entrypoint.js's comment: the facility's URI builder inserts an invalid empty
  // userinfo section ("mongodb://:@...") when user/password are empty strings.
  json.m0.uri = `mongodb://${mongoHost}:${mongoPort}/${lookupDatabase}`
  json.m0.database = lookupDatabase
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...flag('SECONDARY', '--secondary'),
  ...optional('AUTOBASE_BOOTSTRAP', '--autobase'), // unused in mongodb mode, wired for parity/future-proofing
]

spawnWorker(argv)
