// Gradient stops for expo-linear-gradient's `colors` prop. Gradients are rationed
// the same way the gold accent is: CTA, balance hero, onboarding — nowhere else.
export const gradients = {
  // Primary CTA and highlights — replicates the logo shield (light gold → dark gold).
  gold: ['#F5D381', '#D0A64E'],
  // BalanceHero backdrop: a barely-there gold veil fading into the elevated navy.
  hero: ['rgba(245, 211, 129, 0.10)', 'rgba(40, 50, 62, 0)'],
  // Full-screen backdrop for onboarding.
  midnight: ['#131A23', '#0C1117'],
} as const;
