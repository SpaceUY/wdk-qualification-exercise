import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const projectRoot = path.join(__filename, '../..')

const require = createRequire(pathToFileURL(projectRoot + '/'))

const bareKitPath = path.dirname(require.resolve('react-native-bare-kit/package.json'))

// bare-link is CommonJS — use createRequire so it loads from the project's node_modules
const link = require('bare-link')

const targets = [
  {
    platform: 'ios',
    hosts: ['ios-arm64', 'ios-arm64-simulator', 'ios-x64-simulator'],
    out: path.join(bareKitPath, 'ios', 'addons')
  },
  {
    platform: 'android',
    hosts: ['android-arm64', 'android-arm', 'android-ia32', 'android-x64'],
    out: path.join(bareKitPath, 'android', 'src', 'main', 'addons')
  }
]

console.log('Running bare-link from app root:', projectRoot)

for (const { platform, hosts, out } of targets) {
  console.log(`Output ${platform} addons to:`, out)

  let count = 0
  for await (const resource of link(projectRoot, { hosts, out })) {
    console.log('Linked addon:', resource)
    count++
  }

  if (count === 0) {
    console.log(`No ${platform} addons found (bare-crypto prebuilds may already be up to date or not present)`)
  } else {
    console.log(`Linked ${count} ${platform} addon resource(s)`)
  }
}
