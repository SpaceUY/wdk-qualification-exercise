import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Bitcoin, Sparkle, Zap } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { AppText } from '@/components/ui';

// Per-token brand colors, independent of which chain the asset lives on (e.g. USDT
// is the same Tether teal on Ethereum, Arbitrum, Polygon and Tron alike — NetworkDot
// is what disambiguates the chain).
const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', // Ethereum's own brand periwinkle.
  USDT: '#26A17B', // Tether's official teal.
  BTC: '#F7931A', // Bitcoin orange.
  sBTC: '#EAB308', // Spark's amber — a bolt glyph marks it as the L2, not vanilla BTC.
  UTL: '#E8C270', // Northstar's own gold accent — this is the app's own token.
};

export function TokenLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const colors = useThemeColors();
  const background = TOKEN_COLORS[symbol];
  const glyphSize = Math.round(size * 0.55);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: background ?? colors.surfaceMuted },
      ]}
    >
      {background == null ? (
        // Unknown symbol (not one of the five configured tokens): initial letter
        // on a neutral surface instead of guessing at a brand color.
        <AppText style={[styles.letter, { fontSize: glyphSize }]} color="textMuted">
          {symbol.charAt(0)}
        </AppText>
      ) : (
        <TokenGlyph symbol={symbol} size={glyphSize} />
      )}
    </View>
  );
}

function TokenGlyph({ symbol, size }: { symbol: string; size: number }) {
  switch (symbol) {
    case 'ETH':
      return <EthDiamond size={size} />;
    case 'USDT':
      return <AppText style={[styles.letter, { fontSize: size, color: '#FFFFFF' }]}>T</AppText>;
    case 'BTC':
      return <Bitcoin size={size} color="#FFFFFF" strokeWidth={2.25} />;
    case 'sBTC':
      return <Zap size={size} color="#221C0E" fill="#221C0E" />;
    case 'UTL':
      return <Sparkle size={size} color="#221C0E" fill="#221C0E" />;
    default:
      return null;
  }
}

// A simplified take on Ethereum's own two-facet diamond mark.
function EthDiamond({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="12,2 19,12 12,15 5,12" fill="#FFFFFF" opacity={0.85} />
      <Polygon points="12,15 19,12 12,22 5,12" fill="#FFFFFF" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { fontWeight: '800' },
});
