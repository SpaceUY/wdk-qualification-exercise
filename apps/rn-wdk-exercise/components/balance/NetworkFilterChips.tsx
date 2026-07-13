import { FilterChips, type FilterChipOption } from '@/components/ui';

export type NetworkFilter = 'all' | 'mainnet' | 'testnet';

const FILTERS: FilterChipOption<NetworkFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'mainnet', label: 'Mainnet' },
  { key: 'testnet', label: 'Testnet' },
];

export type NetworkFilterChipsProps = {
  value: NetworkFilter;
  onChange: (value: NetworkFilter) => void;
};

// Sits between the balance card and the asset list, scoping which chains' rows show.
export function NetworkFilterChips({ value, onChange }: NetworkFilterChipsProps) {
  return (
    <FilterChips
      options={FILTERS}
      value={value}
      onChange={onChange}
      testIDPrefix="network-filter"
    />
  );
}
