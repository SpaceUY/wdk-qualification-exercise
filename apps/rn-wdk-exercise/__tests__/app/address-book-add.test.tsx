import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from 'sonner-native';
import AddContactScreen from '../../app/(wallet)/address-book/add';
import SendAddContactRoute from '../../app/(wallet)/send/add-contact';
import { useAddressBookStore } from '../../stores/addressBookStore';

describe('AddContactScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    useAddressBookStore.setState({ contacts: [] });
  });

  it('is also mounted inside the send stack as the stacked-modal route', () => {
    expect(SendAddContactRoute).toBe(AddContactScreen);
  });

  async function fillForm(name: string, address: string) {
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Mom, Cold wallet'), name);
    await fireEvent.changeText(screen.getByPlaceholderText('Paste the address'), address);
  }

  it('requires a name', async () => {
    await render(<AddContactScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Paste the address'), '0xabc');
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(toast.error).toHaveBeenCalledWith('Name Required', {
      description: 'Give this contact a name or alias.',
    });
    expect(useAddressBookStore.getState().contacts).toEqual([]);
  });

  it('requires an address', async () => {
    await render(<AddContactScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Mom, Cold wallet'), 'Mom');
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(toast.error).toHaveBeenCalledWith('Address Required', {
      description: 'Paste the address to save.',
    });
  });

  it('saves an EVM contact by default (network null) and navigates back', async () => {
    await render(<AddContactScreen />);

    await fillForm('Mom', '  0xabc  ');
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(useAddressBookStore.getState().contacts[0]).toMatchObject({
      name: 'Mom',
      address: '0xabc', // trimmed
      network: null,
    });
    expect(toast.success).toHaveBeenCalledWith('Contact Saved');
    expect(router.back).toHaveBeenCalled();
  });

  it('saves the selected chain-specific network', async () => {
    await render(<AddContactScreen />);

    await fillForm('Exchange', 'bc1qxyz');
    await fireEvent.press(screen.getByText('Bitcoin'));
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(useAddressBookStore.getState().contacts[0]).toMatchObject({ network: 'bitcoin' });
  });

  it('preselects the chain from the send-flow network param', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'tron' });

    await render(<AddContactScreen />);

    await fillForm('Tron Friend', 'TXYZabc');
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(useAddressBookStore.getState().contacts[0]).toMatchObject({ network: 'tron' });
  });

  it('collapses an EVM send network to the shared EVM option', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'arbitrum' });

    await render(<AddContactScreen />);

    await fillForm('Arb Friend', '0xdef');
    await fireEvent.press(screen.getByText('Save Contact'));

    expect(useAddressBookStore.getState().contacts[0]).toMatchObject({ network: null });
  });
});
