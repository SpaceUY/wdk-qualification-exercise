/** @type {import('@tetherto/wdk-worklet-bundler').WdkBundleConfig} */
module.exports = {
  networks: {
    ethereum: { package: '@tetherto/wdk-wallet-evm' },
    arbitrum: { package: '@tetherto/wdk-wallet-evm' },
    polygon: { package: '@tetherto/wdk-wallet-evm' },
    bitcoin: { package: '@tetherto/wdk-wallet-btc' },
    spark: { package: '@tetherto/wdk-wallet-spark' },
  },
  output: {
    bundle: './.wdk-bundle/wdk-worklet.bundle.js',
  },
};
