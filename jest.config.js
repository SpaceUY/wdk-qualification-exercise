const path = require('path');

/** @type {import('jest').Config} */
const config = {
  preset: 'react-native',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native-vector-icons$': '@expo/vector-icons',
    '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
  },

  // These packages ship ESM source — Jest must transform them via Babel.
  // We extend with additional packages used by this project.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-mmkv|zustand|@tetherto|nativewind))',
    '/node_modules/react-native-reanimated/plugin/',
  ],

  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.js')],
};

module.exports = config;
