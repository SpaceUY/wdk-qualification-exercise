import { useMemo, useState } from 'react';
import type { TokenTransfer } from '@/utils/appNodeApi';
import { isReceived } from '@/utils/transfers';
import type { FilterChipOption } from '@/components/ui';

export type DirectionFilter = 'all' | 'received' | 'sent';

export const DIRECTION_FILTERS: FilterChipOption<DirectionFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
];

// Direction (all/received/sent) filter state + the filtered transfer list.
// Single owner for the logic duplicated in history.tsx and asset/[id].tsx.
export function useDirectionFilter(
  transfers: TokenTransfer[] | undefined,
  myAddresses: string[],
) {
  const [filter, setFilter] = useState<DirectionFilter>('all');
  const visibleTransfers = useMemo(() => {
    if (filter === 'all') return transfers;
    return transfers?.filter(
      (t) => isReceived(t, myAddresses) === (filter === 'received'),
    );
  }, [transfers, filter, myAddresses]);
  return { filter, setFilter, options: DIRECTION_FILTERS, visibleTransfers };
}
