'use strict'

// Shared spawn + signal-forwarding logic, lifted verbatim (structurally) from
// wdk-indexer-wrk-btc/docker-entrypoint.js so every service's container shuts down
// cleanly under `docker compose stop` / K8s `terminationGracePeriodSeconds`.

const { spawn } = require('node:child_process')

function spawnWorker (argv) {
  const child = spawn(process.execPath, argv, { stdio: 'inherit' })

  let shuttingDown = false
  const forward = (sig) => () => {
    if (shuttingDown) return
    shuttingDown = true
    try { child.kill(sig) } catch (_) { /* child already exited */ }
  }

  process.on('SIGTERM', forward('SIGTERM'))
  process.on('SIGINT', forward('SIGINT'))
  process.on('SIGHUP', forward('SIGHUP'))

  child.on('exit', (code, signal) => {
    if (signal) {
      const num = require('node:os').constants.signals[signal] || 0
      process.exit(128 + num)
    }
    process.exit(code ?? 1)
  })
}

module.exports = { spawnWorker }
