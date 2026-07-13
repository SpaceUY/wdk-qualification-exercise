import { buildMerchantRows } from '../../components/addressBook/buildMerchantRows';
import type { MerchantsResponse } from '../../utils/api';

const NAMED_ADDRESS = '0xaaaa567890abcdef1234567890abcdef1234aaaa';
const UNNAMED_ADDRESS = '0xbbbb567890abcdef1234567890abcdef1234bbbb';

const MERCHANTS: MerchantsResponse = {
  addresses: [NAMED_ADDRESS, UNNAMED_ADDRESS],
  names: { [NAMED_ADDRESS]: 'Coffee Corner' },
  cashbackRate: 0.05,
};

describe('buildMerchantRows', () => {
  it('cooks backend merchants into display-ready rows', () => {
    const [row] = buildMerchantRows(MERCHANTS);

    expect(row).toEqual({
      id: NAMED_ADDRESS,
      name: 'Coffee Corner',
      initials: 'CC',
      truncatedAddress: '0xaaaa...aaaa',
      networkLabel: 'EVM',
      address: NAMED_ADDRESS,
    });
  });

  it('falls back to the shared default name for unnamed merchants', () => {
    const rows = buildMerchantRows(MERCHANTS);

    expect(rows[1]).toEqual({
      id: UNNAMED_ADDRESS,
      name: 'Affiliated merchant',
      initials: 'AM',
      truncatedAddress: '0xbbbb...bbbb',
      networkLabel: 'EVM',
      address: UNNAMED_ADDRESS,
    });
  });

  it('returns an empty list when the backend has no merchants', () => {
    expect(buildMerchantRows({ addresses: [], names: {}, cashbackRate: 0.05 })).toEqual([]);
  });
});
