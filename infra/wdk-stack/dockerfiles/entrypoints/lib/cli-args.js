'use strict'

// Shared env-var -> CLI-flag translation helpers, lifted from wdk-indexer-wrk-btc's
// docker-entrypoint.js (the only repo that shipped a real entrypoint). `flag()` is an
// addition for boolean-only CLI switches like wdk-ork-wrk's `--secondary`, which BTC's
// original `optional()` (value-flag pairs) can't express.

const required = (name) => {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    process.stderr.write(`[entrypoint] env var ${name} is required\n`)
    process.exit(64) // EX_USAGE
  }
  return v.trim()
}

const optional = (name, flag) => {
  const v = process.env[name]
  if (!v || v.trim() === '') return []
  return [flag, v.trim()]
}

const flag = (name, cliFlag) => (process.env[name] === 'true' ? [cliFlag] : [])

module.exports = { required, optional, flag }
