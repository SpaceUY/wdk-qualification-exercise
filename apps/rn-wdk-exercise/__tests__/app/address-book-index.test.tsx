import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import AddressBookScreen from '../../app/(wallet)/address-book/index';
import { useAddressBookStore } from '../../stores/addressBookStore';
import type { MerchantsResponse } from '../../utils/api';

const mockGetMerchants = jest.fn();
jest.mock('../../utils/api', () => ({
  getMerchants: () => mockGetMerchants(),
}));

const CONTACT = {
  id: 'c1',
  name: 'Cold Wallet',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  network: null,
  createdAt: '2026-07-13T00:00:00.000Z',
};

const MERCHANT_ADDRESS = '0xaaaa567890abcdef1234567890abcdef1234aaaa';

function someMerchants(): MerchantsResponse {
  return {
    addresses: [MERCHANT_ADDRESS],
    names: { [MERCHANT_ADDRESS]: 'Coffee Corner' },
    cashbackRate: 0.05,
  };
}

function renderScreen() {
  // gcTime: 0 avoids leaving a 5-minute garbage-collection setTimeout alive per test,
  // which otherwise keeps the Jest worker process from exiting.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddressBookScreen />
    </QueryClientProvider>,
  );
}

describe('AddressBookScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAddressBookStore.setState({ contacts: [] });
    mockGetMerchants.mockResolvedValue(someMerchants());
  });

  it('shows the empty state when there are no contacts', async () => {
    await renderScreen();

    expect(screen.getByText('No saved contacts yet')).toBeTruthy();
  });

  it('lists saved contacts', async () => {
    useAddressBookStore.setState({ contacts: [CONTACT] });

    await renderScreen();

    expect(screen.getByText('Cold Wallet')).toBeTruthy();
    expect(screen.getByText('0x1234...5678')).toBeTruthy();
  });

  it('navigates to the add-contact form from the header button', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('address-book-add-button'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/address-book/add');
  });

  it('copies the address to the clipboard when the row is tapped', async () => {
    useAddressBookStore.setState({ contacts: [CONTACT] });
    await renderScreen();

    await fireEvent.press(screen.getByText('Cold Wallet'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(CONTACT.address);
    expect(toast.success).toHaveBeenCalledWith('Copied', {
      description: 'Address copied to clipboard',
    });
  });

  it('asks for confirmation before deleting and removes on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      // Simulate the user tapping the destructive "Delete" button.
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    useAddressBookStore.setState({ contacts: [CONTACT] });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('contact-delete-c1'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Contact',
      'Remove "Cold Wallet" from your address book?',
      expect.any(Array),
    );
    expect(useAddressBookStore.getState().contacts).toEqual([]);
  });

  describe('Merchants tab', () => {
    it('lists backend merchants read-only: no delete affordance', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('address-book-tab-merchants'));

      expect(await screen.findByText('Coffee Corner')).toBeTruthy();
      expect(screen.getByText('0xaaaa...aaaa')).toBeTruthy();
      expect(screen.queryByTestId(`contact-delete-${MERCHANT_ADDRESS}`)).toBeNull();
    });

    it('copies the merchant address when the row is tapped', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('address-book-tab-merchants'));
      await fireEvent.press(await screen.findByText('Coffee Corner'));

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MERCHANT_ADDRESS);
      expect(toast.success).toHaveBeenCalledWith('Copied', {
        description: 'Address copied to clipboard',
      });
    });

    it('shows an empty state when the backend has no merchants', async () => {
      mockGetMerchants.mockResolvedValue({ addresses: [], names: {}, cashbackRate: 0.05 });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('address-book-tab-merchants'));

      expect(await screen.findByText('No merchants available')).toBeTruthy();
    });

    it('shows an error state when the merchants request fails', async () => {
      mockGetMerchants.mockRejectedValue(new Error('network down'));
      await renderScreen();

      await fireEvent.press(screen.getByTestId('address-book-tab-merchants'));

      expect(await screen.findByText("Couldn't load merchants")).toBeTruthy();
    });

    it('switches back to the contacts tab', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('address-book-tab-merchants'));
      await fireEvent.press(screen.getByTestId('address-book-tab-contacts'));

      expect(screen.getByText('No saved contacts yet')).toBeTruthy();
    });
  });
});
