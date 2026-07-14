// Boundary-level recipient validation for the Send screen: catches the common
// mistakes (empty, wrong-network format, obvious garbage) before navigating to
// confirm, instead of only failing at signing. This is a UX guard, not the
// security boundary — the WDK signer still performs authoritative validation.
const EVM_NETWORKS = new Set(['ethereum', 'arbitrum', 'polygon']);
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
// Bitcoin: legacy/P2SH base58 (1/3...) or bech32 (bc1...). Length-bounded sanity check.
const BTC_ADDRESS = /^(bc1[0-9a-z]{25,62}|[13][1-9A-HJ-NP-Za-km-z]{25,39})$/;

export function isValidAddressForNetwork(address: string, network: string): boolean {
  const value = address.trim();
  if (!value) return false;
  if (EVM_NETWORKS.has(network)) return EVM_ADDRESS.test(value);
  if (network === 'tron') return TRON_ADDRESS.test(value);
  if (network === 'bitcoin') return BTC_ADDRESS.test(value);
  // Spark and any future network: fall back to a non-empty, non-EVM-typo check
  // (the signer validates authoritatively). Reject an obvious EVM paste here.
  return !EVM_ADDRESS.test(value);
}
