const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pnpm stores packages as symlinks; Metro needs this to follow them
config.resolver.unstable_enableSymlinks = true;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

module.exports = config;
