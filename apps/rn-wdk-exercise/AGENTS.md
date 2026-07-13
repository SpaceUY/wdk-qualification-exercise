# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## UI layer rules

- `components/ui/` is the presentational layer: props in, pixels out. Files there must NOT import from `@tetherto/*`, `hooks/`, `stores/`, or `utils/api` — only React Native, `theme/`, and other `ui/` components. Verifiable with grep.
- Dumb components receive cooked data: formatted strings, `isLoading`/`isHidden` booleans, callbacks. Never a raw WDK object. Amount formatting lives in `utils/balance.ts`.
- Containers (feature components that call WDK/store hooks) map data to props and own no styles beyond trivial layout.
- Screens under `app/` compose containers and navigation; they don't draw rows or format amounts.
- Colors always come from `theme/colors.ts` tokens (the app is dark-only); spacing/radius/type from `theme/tokens.ts`. A raw hex or fontSize in a screen is a review flag. Gold accent + gradients are rationed: primary CTA, active tab, brand moments only.
