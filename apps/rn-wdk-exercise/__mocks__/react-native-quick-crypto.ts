import { scrypt, scryptSync } from 'crypto';

// react-native-quick-crypto is a native (Nitro) module with no Jest-runnable binary.
// Node's built-in crypto.scrypt implements the same RFC 7914 algorithm with a matching
// (password, salt, keylen, options, callback) signature, so it's a drop-in stand-in for tests.
export default { scrypt, scryptSync };
