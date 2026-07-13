import type { TextProps } from 'react-native';
import { type ThemeColors } from '@/theme/colors';
import { type TypographyVariant } from '@/theme/tokens';
import { AppText } from './AppText';

export type AmountTextProps = Omit<TextProps, 'children'> & {
  // Already-formatted amount ("0.0421 ETH", "$1,234.56") — containers format via
  // utils/balance; this component never does math or number formatting.
  value: string;
  // Privacy mode: renders a mask instead of the amount (settings-driven).
  hidden?: boolean;
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
};

const MASK = '••••';

export function AmountText({ value, hidden = false, variant = 'mono', color = 'textPrimary', ...rest }: AmountTextProps) {
  return (
    <AppText
      variant={variant}
      color={color}
      accessibilityLabel={hidden ? 'Balance hidden' : value}
      {...rest}
    >
      {hidden ? MASK : value}
    </AppText>
  );
}
