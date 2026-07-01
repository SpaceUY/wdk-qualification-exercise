import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const projectRoot = path.join(__filename, '../..')

const require = createRequire(pathToFileURL(projectRoot + '/'))

const bareKitPath = path.dirname(require.resolve('react-native-bare-kit/package.json'))
const addonsOut = path.join(bareKitPath, 'ios', 'addons')

// bare-link is CommonJS — use createRequire so it loads from the project's node_modules
const link = require('bare-link')

console.log('Running bare-link from app root:', projectRoot)
console.log('Output addons to:', addonsOut)

let count = 0
for await (const resource of link(projectRoot, {
  hosts: ['ios-arm64', 'ios-arm64-simulator', 'ios-x64-simulator'],
  out: addonsOut
})) {
  console.log('Linked addon:', resource)
  count++
}

if (count === 0) {
  console.log('No addons found (bare-crypto prebuilds may already be up to date or not present)')
} else {
  console.log(`Linked ${count} addon resource(s)`)
}
