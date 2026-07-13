import { useAddressBookStore } from '../../stores/addressBookStore';

describe('addressBookStore', () => {
  beforeEach(() => {
    useAddressBookStore.setState({ contacts: [] });
    jest.clearAllMocks();
  });

  it('starts with no contacts', () => {
    expect(useAddressBookStore.getState().contacts).toEqual([]);
  });

  describe('addContact', () => {
    it('appends the contact with a generated id and createdAt', () => {
      useAddressBookStore.getState().addContact({ name: 'Mom', address: '0xabc', network: null });

      const [contact] = useAddressBookStore.getState().contacts;
      expect(contact).toMatchObject({ name: 'Mom', address: '0xabc', network: null });
      expect(contact!.id).toEqual(expect.any(String));
      expect(contact!.createdAt).toEqual(expect.any(String));
    });

    it('gives each contact a distinct id', () => {
      useAddressBookStore.getState().addContact({ name: 'A', address: '0x1', network: null });
      useAddressBookStore.getState().addContact({ name: 'B', address: '0x2', network: null });

      const [a, b] = useAddressBookStore.getState().contacts;
      expect(a!.id).not.toBe(b!.id);
    });

    it('preserves a chain-specific network', () => {
      useAddressBookStore.getState().addContact({ name: 'Exchange', address: 'bc1q...', network: 'bitcoin' });

      expect(useAddressBookStore.getState().contacts[0]!.network).toBe('bitcoin');
    });
  });

  describe('removeContact', () => {
    it('removes only the matching contact', () => {
      useAddressBookStore.getState().addContact({ name: 'A', address: '0x1', network: null });
      useAddressBookStore.getState().addContact({ name: 'B', address: '0x2', network: null });
      const [a] = useAddressBookStore.getState().contacts;

      useAddressBookStore.getState().removeContact(a!.id);

      const remaining = useAddressBookStore.getState().contacts;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.name).toBe('B');
    });

    it('is a no-op for an unknown id', () => {
      useAddressBookStore.getState().addContact({ name: 'A', address: '0x1', network: null });

      useAddressBookStore.getState().removeContact('does-not-exist');

      expect(useAddressBookStore.getState().contacts).toHaveLength(1);
    });
  });
});
