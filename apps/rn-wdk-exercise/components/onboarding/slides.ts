import { CloudCheck, Globe, ShieldCheck, Tag, type LucideIcon } from 'lucide-react-native';

export type OnboardingSlideData = {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
};

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    key: 'self-custody',
    icon: ShieldCheck,
    title: 'Your keys, your crypto',
    subtitle: 'Northstar is fully self-custodial. Your seed phrase is created and stored on this device — never on our servers.',
  },
  {
    key: 'multichain',
    icon: Globe,
    title: 'One wallet, every chain',
    subtitle: 'Hold and send ETH, BTC and USDT across Ethereum, Bitcoin, Tron, Spark and L2 networks from a single place.',
  },
  {
    key: 'cashback',
    icon: Tag,
    title: 'Get rewarded for paying',
    subtitle: 'Pay at affiliated merchants with USDT and earn cashback back in your wallet, automatically.',
  },
  {
    key: 'backup',
    icon: CloudCheck,
    title: 'Back up once, relax',
    subtitle: 'An encrypted cloud backup keeps your wallet recoverable even if you lose this phone.',
  },
];
