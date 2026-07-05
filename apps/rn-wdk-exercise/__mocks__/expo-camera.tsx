import { View } from 'react-native';

// Forwards all props (including onBarcodeScanned) onto a plain View so RNTL's generic
// fireEvent(instance, 'barcodeScanned', data) can find and invoke the handler.
export function CameraView(props: Record<string, unknown>) {
  return <View testID="mock-camera-view" {...props} />;
}

export const useCameraPermissions = jest.fn();
