// Load jest-expo internal setup. We use preset:'react-native' instead of preset:'jest-expo'
// because react-native 0.81.5's jest/setup.js uses ESM import syntax that Jest's CJS runner
// cannot load. This path is an unstable internal — if jest-expo changes it on a patch bump,
// require.resolve will throw loudly rather than silently skip setup.
require(require.resolve('jest-expo/src/preset/setup.js'));

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Encryption is not supported')) return;
  originalConsoleWarn(...args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('not wrapped in act') || args[0].includes('Warning:'))) return;
  originalConsoleError(...args);
};
