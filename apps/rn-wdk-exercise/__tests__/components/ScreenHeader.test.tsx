import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';

describe('ScreenHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the given title', async () => {
    await render(<ScreenHeader title="My Screen" />);
    expect(screen.getByText('My Screen')).toBeTruthy();
  });

  it('navigates back when the back button is pressed', async () => {
    await render(<ScreenHeader title="My Screen" />);
    await fireEvent.press(screen.getByTestId('screen-header-back'));
    expect(router.back).toHaveBeenCalled();
  });
});
