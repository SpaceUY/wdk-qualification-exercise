export const MOCK_REDEMPTION_TX_HASH =
  '0xmockredemptiontxhash00000000000000000000000000000000000000000';
export const MOCK_TREASURY_ADDRESS = '0xmocktreasuryaddress0000000000000000000000';

export function createMockUtlContract(): {
  getAddress: jest.Mock;
  interface: { encodeFunctionData: jest.Mock };
} {
  return {
    getAddress: jest.fn().mockResolvedValue('0xutladdress'),
    interface: { encodeFunctionData: jest.fn().mockReturnValue('0xencodeddata') },
  };
}

// CouponsService populates a transaction (nonce/fee/gas/chainId) via a plain
// ethers.JsonRpcProvider before handing it to WDK's treasuryAccount.signTransaction() —
// this covers those read-only chain calls. No key material is ever involved here.
export function createMockJsonRpcProvider(): {
  getTransactionCount: jest.Mock;
  getFeeData: jest.Mock;
  getNetwork: jest.Mock;
  estimateGas: jest.Mock;
} {
  return {
    getTransactionCount: jest.fn().mockResolvedValue(0),
    getFeeData: jest.fn().mockResolvedValue({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n }),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }),
    estimateGas: jest.fn().mockResolvedValue(21000n),
  };
}

// Mocks `@tetherto/wdk-wallet-evm`'s WalletAccountEvm. CouponsService only ever calls
// its public API (getAddress/signTransaction/sendTransaction/getTransaction/
// waitForTransaction) — it no longer reaches into any internal/protected field.
export function createMockWalletAccountEvm(txHash: string = MOCK_REDEMPTION_TX_HASH): {
  getAddress: jest.Mock;
  signTransaction: jest.Mock;
  sendTransaction: jest.Mock;
  getTransaction: jest.Mock;
  waitForTransaction: jest.Mock;
} {
  return {
    getAddress: jest.fn().mockResolvedValue(MOCK_TREASURY_ADDRESS),
    signTransaction: jest.fn().mockResolvedValue('0xsignedtx'),
    sendTransaction: jest.fn().mockResolvedValue({ hash: txHash, fee: 1n }),
    // WDK's getTransaction throws NoSuchElementError when nothing is found, instead
    // of resolving null — the default here simulates "found".
    getTransaction: jest.fn().mockResolvedValue({ hash: txHash, finality: 'confirmed', success: true }),
    waitForTransaction: jest.fn().mockResolvedValue({ hash: txHash, finality: 'confirmed', success: true }),
  };
}

export function createMockTransactionFrom(txHash: string = MOCK_REDEMPTION_TX_HASH): jest.Mock {
  return jest.fn().mockReturnValue({ hash: txHash });
}
