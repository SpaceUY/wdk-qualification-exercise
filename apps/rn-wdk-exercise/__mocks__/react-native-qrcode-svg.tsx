import { Text } from 'react-native';

// The real component renders actual SVG paths, which isn't useful (or renderable) in a
// jsdom-free RN test renderer. Expose the `value` prop as text so tests can assert on it.
export default function QRCode({ value }: { value: string }) {
  return <Text testID="mock-qrcode">{value}</Text>;
}
