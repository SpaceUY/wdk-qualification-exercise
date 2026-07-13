import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type OnboardingSlideData = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
};

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    key: 'self-custody',
    icon: 'shield-checkmark-outline',
    title: 'Your keys, your crypto',
    subtitle: 'Northstar is fully self-custodial. Your seed phrase is created and stored on this device — never on our servers.',
  },
  {
    key: 'multichain',
    icon: 'globe-outline',
    title: 'One wallet, every chain',
    subtitle: 'Hold and send ETH, BTC and USDT across Ethereum, Bitcoin, Tron, Spark and L2 networks from a single place.',
  },
  {
    key: 'cashback',
    icon: 'pricetag-outline',
    title: 'Get rewarded for paying',
    subtitle: 'Pay at affiliated merchants with USDT and earn cashback back in your wallet, automatically.',
  },
  {
    key: 'backup',
    icon: 'cloud-done-outline',
    title: 'Back up once, relax',
    subtitle: 'An encrypted cloud backup keeps your wallet recoverable even if you lose this phone.',
  },
];
