const path = require('path');

/** @type {import('jest').Config} */
const config = {
  preset: 'react-native',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // The RN jest resolver honors the package's "react-native"/"module" export condition,
    // which points at an .mjs build — Jest's default transform only matches .js/.ts/.tsx,
    // so that file reaches the VM untransformed and throws on `export`. Force the CJS build.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(ttf|otf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // These packages ship ESM source — Jest must transform them via Babel.
  // We extend with additional packages used by this project.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-mmkv|zustand|@tetherto|@noble|lucide-react-native))',
    '/node_modules/react-native-reanimated/plugin/',
  ],

  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.js')],

  // Default 5s is too tight when this suite runs concurrently with the backend's under CI's
  // shared CPU (turbo runs independent packages' test tasks in parallel by default).
  testTimeout: 15000,

  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],

  coverageThreshold: {
    global: { statements: 90, branches: 80, functions: 90, lines: 90 },
  },
};

module.exports = config;
