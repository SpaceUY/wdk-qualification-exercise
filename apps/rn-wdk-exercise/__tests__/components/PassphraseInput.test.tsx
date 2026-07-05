import { fireEvent, render, screen } from '@testing-library/react-native';
import { PassphraseInput } from '../../components/PassphraseInput';

describe('PassphraseInput', () => {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a passphrase shorter than the minimum length', async () => {
    await render(<PassphraseInput submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />);

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'short');
    await fireEvent.press(screen.getByText('Go'));

    expect(screen.getByText('Passphrase must be at least 8 characters.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a passphrase that is too repetitive', async () => {
    await render(<PassphraseInput submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />);

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'aaaaaaaa');
    await fireEvent.press(screen.getByText('Go'));

    expect(
      screen.getByText('Passphrase is too repetitive — use a mix of different characters.'),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid passphrase with no confirm field required', async () => {
    await render(<PassphraseInput submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />);

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'a-valid-passphrase');
    await fireEvent.press(screen.getByText('Go'));

    expect(onSubmit).toHaveBeenCalledWith('a-valid-passphrase');
  });

  it('does not render a confirm field when confirm is false', async () => {
    await render(<PassphraseInput submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />);
    expect(screen.queryByTestId('passphrase-confirm-input')).toBeNull();
  });

  it('renders a confirm field when confirm is true', async () => {
    await render(
      <PassphraseInput confirm submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />,
    );
    expect(screen.getByTestId('passphrase-confirm-input')).toBeTruthy();
  });

  it('rejects mismatched confirmation when confirm is true', async () => {
    await render(
      <PassphraseInput confirm submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'a-valid-passphrase');
    await fireEvent.changeText(screen.getByTestId('passphrase-confirm-input'), 'different-passphrase');
    await fireEvent.press(screen.getByText('Go'));

    expect(screen.getByText('Passphrases do not match.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits when confirm is true and both fields match', async () => {
    await render(
      <PassphraseInput confirm submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'a-valid-passphrase');
    await fireEvent.changeText(screen.getByTestId('passphrase-confirm-input'), 'a-valid-passphrase');
    await fireEvent.press(screen.getByText('Go'));

    expect(onSubmit).toHaveBeenCalledWith('a-valid-passphrase');
  });

  it('calls onCancel when Cancel is pressed', async () => {
    await render(<PassphraseInput submitLabel="Go" onSubmit={onSubmit} onCancel={onCancel} />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('accepts a repetitive passphrase when validateStrength is false (restore path)', async () => {
    await render(
      <PassphraseInput
        submitLabel="Go"
        onSubmit={onSubmit}
        onCancel={onCancel}
        validateStrength={false}
      />,
    );

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'aaaaaaaa');
    await fireEvent.press(screen.getByText('Go'));

    expect(onSubmit).toHaveBeenCalledWith('aaaaaaaa');
  });

  it('still rejects a too-short passphrase with a length-only message when validateStrength is false', async () => {
    await render(
      <PassphraseInput
        submitLabel="Go"
        onSubmit={onSubmit}
        onCancel={onCancel}
        validateStrength={false}
      />,
    );

    await fireEvent.changeText(screen.getByTestId('passphrase-input'), 'short');
    await fireEvent.press(screen.getByText('Go'));

    expect(screen.getByText('Passphrase must be at least 8 characters.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
