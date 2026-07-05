'use strict'

// Shared by every service's docker-entrypoint.js. Patches the JSON config files that
// setup-config.sh copied from *.example at build time, filling in the handful of
// environment-dependent fields (hostnames, secrets, per-chain settings) right before
// worker.js boots. Kept as a JSON read-patch-write (not sed/envsubst) so it's robust to
// upstream reformatting the example files — see docs/wdk-self-hosted-stack/01-core-pipeline.md §3.

const fs = require('node:fs')
const path = require('node:path')

function patchJson (file, patchFn) {
  const full = path.isAbsolute(file) ? file : path.join('/app', file)
  const json = JSON.parse(fs.readFileSync(full, 'utf8'))
  patchFn(json)
  fs.writeFileSync(full, JSON.stringify(json, null, 2))
}

function patchJsonIfExists (file, patchFn) {
  const full = path.isAbsolute(file) ? file : path.join('/app', file)
  if (!fs.existsSync(full)) return
  patchJson(full, patchFn)
}

module.exports = { patchJson, patchJsonIfExists }
