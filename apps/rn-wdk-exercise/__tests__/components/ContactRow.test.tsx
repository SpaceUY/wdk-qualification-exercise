import { fireEvent, render, screen } from '@testing-library/react-native';
import { ContactRow } from '../../components/addressBook/ContactRow';
import { buildContactRows } from '../../components/addressBook/buildContactRows';

const CONTACT = {
  id: 'c1',
  name: 'Cold Wallet',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  network: null,
  createdAt: '2026-07-13T00:00:00.000Z',
};

describe('buildContactRows', () => {
  it('cooks stored contacts into display-ready rows', () => {
    const [row] = buildContactRows([CONTACT]);

    expect(row).toEqual({
      id: 'c1',
      name: 'Cold Wallet',
      initials: 'CW',
      truncatedAddress: '0x1234...5678',
      networkLabel: 'EVM',
      address: CONTACT.address,
    });
  });
});

describe('ContactRow', () => {
  const row = buildContactRows([CONTACT])[0]!;

  it('renders initials, name, truncated address and network label', async () => {
    await render(<ContactRow contact={row} onPress={jest.fn()} />);

    expect(screen.getByText('CW')).toBeTruthy();
    expect(screen.getByText('Cold Wallet')).toBeTruthy();
    expect(screen.getByText('0x1234...5678')).toBeTruthy();
    expect(screen.getByText('EVM')).toBeTruthy();
  });

  it('fires onPress when the row is tapped', async () => {
    const onPress = jest.fn();
    await render(<ContactRow contact={row} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Cold Wallet'));

    expect(onPress).toHaveBeenCalled();
  });

  it('shows the delete affordance only when onDelete is provided', async () => {
    const onDelete = jest.fn();
    const first = await render(<ContactRow contact={row} onPress={jest.fn()} onDelete={onDelete} />);

    await fireEvent.press(screen.getByTestId('contact-delete-c1'));
    expect(onDelete).toHaveBeenCalled();

    first.unmount();
    await render(<ContactRow contact={row} onPress={jest.fn()} />);
    expect(screen.queryByTestId('contact-delete-c1')).toBeNull();
  });
});
