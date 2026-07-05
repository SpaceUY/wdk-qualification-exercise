export const MOCK_REDEMPTION_TX_HASH =
  '0xmockredemptiontxhash00000000000000000000000000000000000000000';

export function createMockUtlContract(txHash: string = MOCK_REDEMPTION_TX_HASH): {
  transfer: jest.Mock;
  getAddress: jest.Mock;
  interface: { encodeFunctionData: jest.Mock };
} {
  return {
    transfer: jest.fn().mockResolvedValue({
      hash: txHash,
      wait: jest.fn().mockResolvedValue({ hash: txHash }),
    }),
    getAddress: jest.fn().mockResolvedValue('0xutladdress'),
    interface: { encodeFunctionData: jest.fn().mockReturnValue('0xencodeddata') },
  };
}

// CouponsService builds and signs the UTL transfer itself (via the treasury wallet)
// instead of using the contract's one-shot `transfer()` convenience call — these two
// helpers cover the methods it calls on the mocked `ethers.Wallet`/`ethers.JsonRpcProvider`
// instances, and on `ethers.Transaction`.
export function createMockTreasuryWallet(): {
  populateTransaction: jest.Mock;
  signTransaction: jest.Mock;
} {
  return {
    populateTransaction: jest.fn().mockResolvedValue({ to: '0xutladdress', data: '0xencodeddata' }),
    signTransaction: jest.fn().mockResolvedValue('0xsignedtx'),
  };
}

export function createMockProvider(txHash: string = MOCK_REDEMPTION_TX_HASH): {
  broadcastTransaction: jest.Mock;
  getTransaction: jest.Mock;
} {
  return {
    // Same tx object shape/value the old mocked `transfer()` returned.
    broadcastTransaction: jest.fn().mockResolvedValue({
      hash: txHash,
      wait: jest.fn().mockResolvedValue({ hash: txHash }),
    }),
    getTransaction: jest.fn(),
  };
}

export function createMockTransactionFrom(txHash: string = MOCK_REDEMPTION_TX_HASH): jest.Mock {
  return jest.fn().mockReturnValue({ hash: txHash });
}
