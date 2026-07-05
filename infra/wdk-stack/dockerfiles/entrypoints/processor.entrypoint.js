#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-indexer-processor-wrk (the Transaction Router — one
// instance per (chain,token) pair). MongoDB lookup mode: points at the SAME shared
// `wdk_lookup` database that wdk-ork-wrk and wdk-data-shard-wrk's `mlookup` connection
// use — see docs/wdk-self-hosted-stack/01-core-pipeline.md finding #4. No --autobase flag.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

const mongoHost = process.env.MONGO_HOST || 'mongo'
const mongoPort = Number(process.env.MONGO_PORT || 27017)
const lookupDatabase = process.env.LOOKUP_MONGO_DATABASE || 'wdk_lookup'

patchJson('config/common.json', (json) => {
  json.lookupEngine = 'mongodb' // default is 'autobase' — see doc 01 finding #5
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
})

patchJson('config/facs/redis.config.json', (json) => {
  json.r0.host = process.env.REDIS_HOST || 'redis'
  json.r0.port = Number(process.env.REDIS_PORT || 6379)
})

patchJson('config/facs/db-mongo.config.json', (json) => {
  // Set uri directly rather than discrete host/port/database fields: bfx-facs-db-mongo's
  // getFormattedURI() unconditionally inserts user:password@ even when both are empty
  // strings, producing an invalid "mongodb://:@host:port/..." URI (MongoParseError: URI
  // contained empty userinfo section). Setting uri bypasses that builder entirely.
  json.m0.uri = `mongodb://${mongoHost}:${mongoPort}/${lookupDatabase}` // shared wdk_lookup DB, not this service's own DB
  json.m0.database = lookupDatabase
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('RACK', '--rack'),
  ...optional('CHAIN', '--chain'),
  ...optional('TOKEN', '--token'), // required by this repo's CLI — throws ERR_TOKEN_UNDEFINED if missing
]

spawnWorker(argv)
