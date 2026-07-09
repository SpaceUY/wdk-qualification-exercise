import { getExplorerTxUrl } from '../../utils/explorer';
import { isMainnetNetwork, KNOWN_NETWORKS } from '../../config/networkMeta';

const HASH = '0xabc123';

describe('getExplorerTxUrl', () => {
  it('returns the mainnet Arbiscan URL for arbitrum', () => {
    expect(getExplorerTxUrl('arbitrum', HASH)).toBe(`https://arbiscan.io/tx/${HASH}`);
  });

  it('returns the mainnet Polygonscan URL for polygon', () => {
    expect(getExplorerTxUrl('polygon', HASH)).toBe(`https://polygonscan.com/tx/${HASH}`);
  });

  it('returns the mainnet mempool.space URL for bitcoin', () => {
    expect(getExplorerTxUrl('bitcoin', HASH)).toBe(`https://mempool.space/tx/${HASH}`);
  });

  it('returns the mainnet SparkScan URL for spark', () => {
    expect(getExplorerTxUrl('spark', HASH)).toBe(`https://sparkscan.io/tx/${HASH}`);
  });

  it('returns the Sepolia testnet Etherscan URL for ethereum', () => {
    expect(getExplorerTxUrl('ethereum', HASH)).toBe(`https://sepolia.etherscan.io/tx/${HASH}`);
  });

  it('returns the Nile testnet Tronscan URL for tron', () => {
    expect(getExplorerTxUrl('tron', HASH)).toBe(
      `https://nile.tronscan.org/#/transaction/${HASH}`,
    );
  });

  it('returns null for a blockchain with no known explorer', () => {
    expect(getExplorerTxUrl('does-not-exist', HASH)).toBeNull();
  });

  it('appends the raw transaction hash unmodified', () => {
    const weirdHash = 'HASH-With-Mixed_Case.123';
    expect(getExplorerTxUrl('ethereum', weirdHash)).toBe(
      `https://sepolia.etherscan.io/tx/${weirdHash}`,
    );
  });
});

describe('isMainnetNetwork fail-safe policy', () => {
  it('treats a network with no classification as mainnet, so real-funds warnings show', () => {
    expect(isMainnetNetwork('not-a-known-network')).toBe(true);
  });

  it('classifies every known network', () => {
    for (const network of KNOWN_NETWORKS) {
      expect(typeof isMainnetNetwork(network)).toBe('boolean');
    }
  });
});
