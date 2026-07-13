import { render, screen } from '@testing-library/react-native';
import { TokenLogo } from '../../components/TokenLogo';

describe('TokenLogo', () => {
  it.each(['ETH', 'USDT', 'BTC', 'sBTC', 'UTL'])(
    'renders a branded glyph (not the letter fallback) for %s',
    async (symbol) => {
      await render(<TokenLogo symbol={symbol} />);

      // The letter fallback renders the symbol's first character as text; branded
      // glyphs are icons/SVGs (USDT's "T" is the deliberate exception).
      if (symbol === 'USDT') {
        expect(screen.getByText('T')).toBeTruthy();
      } else {
        expect(screen.queryByText(symbol.charAt(0))).toBeNull();
      }
    },
  );

  it('falls back to the symbol initial on a neutral circle for unknown tokens', async () => {
    await render(<TokenLogo symbol="DOGE" />);

    expect(screen.getByText('D')).toBeTruthy();
  });
});
