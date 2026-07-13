import type { AddressBookContact } from '@/stores/addressBookStore';
import { getContactInitials, getContactNetworkLabel, truncateAddress } from '@/utils/addressBook';

export type ContactRowData = {
  id: string;
  name: string;
  initials: string;
  truncatedAddress: string;
  networkLabel: string;
  // Full address, kept alongside the display fields so the send picker can hand it
  // to the recipient input without a second store lookup.
  address: string;
};

// Pure mapper from stored contacts to display-ready row props — same split as
// balance/buildAssetRows: all formatting here, none in JSX.
export function buildContactRows(contacts: AddressBookContact[]): ContactRowData[] {
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    initials: getContactInitials(contact.name),
    truncatedAddress: truncateAddress(contact.address),
    networkLabel: getContactNetworkLabel(contact.network),
    address: contact.address,
  }));
}
