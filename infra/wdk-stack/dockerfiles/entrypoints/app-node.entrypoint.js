#!/usr/bin/env node
'use strict'

// Container entrypoint for wdk-app-node (stateless Fastify REST/JWT gateway). Requires
// a shared Redis (hard dependency — see docs/wdk-self-hosted-stack/01-core-pipeline.md
// finding #2) and discovers ork peers over Hyperswarm; no Mongo config of its own.

const path = require('node:path')
const { patchJson } = require('./entrypoint-lib/render-config')
const { required, optional } = require('./entrypoint-lib/cli-args')
const { spawnWorker } = require('./entrypoint-lib/spawn-worker')

patchJson('config/common.json', (json) => {
  json.topicConf.capability = required('WDK_CAPABILITY')
  json.topicConf.crypto.key = required('WDK_CRYPTO_KEY')
  json.jwtSecret = required('JWT_SECRET')
  // Stale local dev path shipped in the example config — never valid in a container.
  delete json.staticRootPath
  // "ethereum" (the shipped family key) already includes "usdt" and must stay a family name,
  // not "sepolia" — see data-shard.entrypoint.js's comment.
  //
  // BTC runs on mainnet (a project requirement) — the shipped mainnet regex (^[13]...) is
  // already correct here, no patch needed. See doc 02 §0 finding #2 for the now-reverted
  // testnet-address-regex patch this used to carry.
  // Unlike data-shard/ork, this repo's example config is missing "tron" entirely (it already
  // has "bitcoin" and "spark") — see doc 02 §0 finding #1.
  json.blockchains.tron = { ccys: ['usdt'], caseSensitive: { address: true } }
})

patchJson('config/facs/redis.config.json', (json) => {
  json.r0.host = process.env.REDIS_HOST || 'redis'
  json.r0.port = Number(process.env.REDIS_PORT || 6379)
})

patchJson('config/facs/httpd.config.json', (json) => {
  // Ships as {} — Fastify's listen() then defaults to host "127.0.0.1", making the server
  // unreachable from outside the container (and from other containers on wdk-net) despite
  // the port being exposed. See @tetherto/svc-facs-httpd/index.js's listen() call.
  json.h0.host = '0.0.0.0'
})

const argv = [
  path.join(__dirname, 'worker.js'),
  '--wtype', required('WORKER_TYPE'),
  '--env', (process.env.ENV || 'production').trim(),
  ...optional('PORT', '--port'),
]

spawnWorker(argv)
