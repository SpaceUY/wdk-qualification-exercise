import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import SendAddressBookScreen from '../../app/(wallet)/send/address-book';
import { useAddressBookStore } from '../../stores/addressBookStore';
import type { MerchantsResponse } from '../../utils/api';

const mockGetMerchants = jest.fn();
jest.mock('../../utils/api', () => ({
  getMerchants: () => mockGetMerchants(),
}));

const EVM_CONTACT = {
  id: 'evm1',
  name: 'Cold Wallet',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  network: null,
  createdAt: '2026-07-13T00:00:00.000Z',
};

const BTC_CONTACT = {
  id: 'btc1',
  name: 'Exchange',
  address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  network: 'bitcoin',
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

function setParams(params: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

function renderScreen() {
  // gcTime: 0 avoids leaving a 5-minute garbage-collection setTimeout alive per test,
  // which otherwise keeps the Jest worker process from exiting.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SendAddressBookScreen />
    </QueryClientProvider>,
  );
}

describe('SendAddressBookScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAddressBookStore.setState({ contacts: [EVM_CONTACT, BTC_CONTACT] });
    setParams({ network: 'ethereum' });
    mockGetMerchants.mockResolvedValue(someMerchants());
  });

  it('lists only contacts valid on the network being sent on', async () => {
    await renderScreen();

    expect(screen.getByText('Cold Wallet')).toBeTruthy();
    expect(screen.queryByText('Exchange')).toBeNull();
  });

  it('shows a Bitcoin contact when sending on bitcoin, hiding EVM ones', async () => {
    setParams({ network: 'bitcoin' });

    await renderScreen();

    expect(screen.getByText('Exchange')).toBeTruthy();
    expect(screen.queryByText('Cold Wallet')).toBeNull();
  });

  it('returns the selection by dismissing back to send, not by pushing a new instance', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Cold Wallet'));

    // dismissTo pops back to the existing send/index; navigate would push a
    // duplicate send screen presented as another modal on top of this sheet.
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/(wallet)/send',
      params: { scannedAddress: EVM_CONTACT.address },
    });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens Add Contact as a stacked modal carrying the current network', async () => {
    setParams({ network: 'spark' });

    await renderScreen();

    expect(screen.getByText('No contacts for this network')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add Contact'));
    // Stacked on top of this sheet — the picker must NOT be popped, so the user
    // returns to it (with the fresh contact) after saving.
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/add-contact',
      params: { network: 'spark' },
    });
  });

  it('closes the sheet before opening the full address book for management', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Manage Contacts'));

    expect(router.back).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/(wallet)/address-book');
  });

  describe('Merchants tab', () => {
    it.each(['ethereum', 'arbitrum', 'polygon', ''])(
      'is offered when the send network is EVM-compatible (%s)',
      async (network) => {
        setParams(network === '' ? {} : { network });

        await renderScreen();

        expect(screen.getByTestId('send-contact-tab-merchants')).toBeTruthy();
      },
    );

    it.each(['bitcoin', 'tron', 'spark'])(
      'is hidden when sending on a non-EVM network (%s)',
      async (network) => {
        setParams({ network });

        await renderScreen();

        expect(screen.queryByTestId('send-contact-tab-merchants')).toBeNull();
        expect(screen.queryByTestId('send-contact-tab-contacts')).toBeNull();
      },
    );

    it('lists merchants without the Add Contact affordance, keeping Manage Contacts', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('send-contact-tab-merchants'));

      expect(await screen.findByText('Coffee Corner')).toBeTruthy();
      expect(screen.queryByText('Add Contact')).toBeNull();
      expect(screen.getByText('Manage Contacts')).toBeTruthy();
    });

    it('returns the merchant selection through the same dismissTo flow as contacts', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('send-contact-tab-merchants'));
      await fireEvent.press(await screen.findByText('Coffee Corner'));

      expect(router.dismissTo).toHaveBeenCalledWith({
        pathname: '/(wallet)/send',
        params: { scannedAddress: MERCHANT_ADDRESS },
      });
    });

    it('shows an empty state when the backend has no merchants', async () => {
      mockGetMerchants.mockResolvedValue({ addresses: [], names: {}, cashbackRate: 0.05 });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('send-contact-tab-merchants'));

      expect(await screen.findByText('No merchants available')).toBeTruthy();
    });

    it('shows an error state when the merchants request fails', async () => {
      mockGetMerchants.mockRejectedValue(new Error('network down'));
      await renderScreen();

      await fireEvent.press(screen.getByTestId('send-contact-tab-merchants'));

      expect(await screen.findByText("Couldn't load merchants")).toBeTruthy();
    });
  });
});
