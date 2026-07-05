import { fireEvent, render, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import QRScanScreen from '../../app/(wallet)/send/scan';

function setPermission(permission: { granted: boolean } | null, requestPermission = jest.fn()) {
  (useCameraPermissions as jest.Mock).mockReturnValue([permission, requestPermission]);
}

describe('QRScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an empty view while permission state is still loading', async () => {
    setPermission(null);

    await render(<QRScanScreen />);

    expect(screen.queryByTestId('mock-camera-view')).toBeNull();
  });

  it('asks for camera permission when not yet granted', async () => {
    const mockRequestPermission = jest.fn();
    setPermission({ granted: false }, mockRequestPermission);

    await render(<QRScanScreen />);
    expect(screen.getByText('Camera permission is required to scan QR codes.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Grant Permission'));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('navigates to send with the parsed address and amount from a JSON QR payload', async () => {
    setPermission({ granted: true });

    await render(<QRScanScreen />);
    await fireEvent(
      screen.getByTestId('mock-camera-view'),
      'barcodeScanned',
      { data: '{"to":"0xRecipientAddress","amount":"1.5"}' },
    );

    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(wallet)/send',
      params: { scannedAddress: '0xRecipientAddress', scannedAmount: '1.5' },
    });
  });

  it('navigates with just an address when the QR payload has no amount', async () => {
    setPermission({ granted: true });

    await render(<QRScanScreen />);
    await fireEvent(screen.getByTestId('mock-camera-view'), 'barcodeScanned', { data: '0xPlainAddress' });

    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(wallet)/send',
      params: { scannedAddress: '0xPlainAddress' },
    });
  });

  it('ignores a second scan once one has already been handled', async () => {
    setPermission({ granted: true });

    await render(<QRScanScreen />);
    const cameraView = screen.getByTestId('mock-camera-view');
    await fireEvent(cameraView, 'barcodeScanned', { data: '0xFirstAddress' });
    await fireEvent(cameraView, 'barcodeScanned', { data: '0xSecondAddress' });

    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('cancels back out of the scanner', async () => {
    setPermission({ granted: true });

    await render(<QRScanScreen />);
    await fireEvent.press(screen.getByText('Cancel'));

    expect(router.back).toHaveBeenCalled();
  });
});
