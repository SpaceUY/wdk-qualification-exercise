import { View } from 'react-native';
import { getNetworkColor } from '@/config/networkMeta';

// Colored dot in the chain's brand color — the at-a-glance cue that tells
// same-symbol assets on different networks (four USDTs) apart.
export function NetworkDot({ network, size = 8 }: { network: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getNetworkColor(network),
      }}
    />
  );
}
