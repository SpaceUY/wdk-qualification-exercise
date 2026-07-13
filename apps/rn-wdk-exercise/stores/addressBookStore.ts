import type { MMKV } from 'react-native-mmkv';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AddressBookContact = {
  id: string;
  name: string;
  // Stored exactly as the user entered it (no lowercasing/checksumming), matching
  // how send/index.tsx treats a pasted recipient.
  address: string;
  // AssetConfig.network the address belongs to ('bitcoin', 'tron', ...). null means
  // "any EVM network" — one 0x address is valid on ethereum/arbitrum/polygon alike,
  // so pinning it to one chain would force the user to save it three times.
  network: string | null;
  createdAt: string;
};

// Device-local uniqueness is all a contact id needs (it's a list key, not a secret),
// so this avoids pulling in a uuid dependency or the crypto API.
function createContactId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type AddressBookStore = {
  contacts: AddressBookContact[];
  addContact: (contact: Omit<AddressBookContact, 'id' | 'createdAt'>) => void;
  removeContact: (id: string) => void;
};

let _instance: MMKV | null = null;
function getInstance(): MMKV {
  if (!_instance) {
    _instance = createMMKV({ id: 'address-book-store' });
  }
  return _instance;
}

const storage = {
  getItem: (name: string) => getInstance().getString(name) ?? null,
  setItem: (name: string, value: string) => getInstance().set(name, value),
  removeItem: (name: string) => getInstance().remove(name),
};

// 100% device-local by design (privacy: alias ↔ address pairs never reach the backend).
export const useAddressBookStore = create<AddressBookStore>()(
  persist(
    (set) => ({
      contacts: [],
      addContact: (contact) =>
        set((state) => ({
          contacts: [
            ...state.contacts,
            { ...contact, id: createContactId(), createdAt: new Date().toISOString() },
          ],
        })),
      removeContact: (id) =>
        set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) })),
    }),
    {
      name: 'address-book-store',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ contacts: state.contacts }),
    },
  ),
);
