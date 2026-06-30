# rn-wdk-exercise

A React Native + Expo reference implementation of the [Tether WDK](https://github.com/tetherto/wdk), demonstrating a production-shaped multi-chain self-custody wallet with biometric authentication and cloud key backup (iCloud on iOS, Google Drive on Android).

## What's implemented

### Authentication
- Sign-in via AWS Cognito Hosted UI using OAuth 2.0 PKCE (`useCognito`, `expo-auth-session`)
- The user's verified email is decoded from the Cognito ID token and used as the `userId` / wallet identifier
- Session (`userId` + Cognito ID token) persisted to MMKV via Zustand so the user stays logged in across app restarts

### Wallet bootstrap
`useWalletBootstrap` runs automatically after login with three paths:
1. **Wallet exists on-device** — set active wallet ID and unlock
2. **No local wallet, cloud backup exists** — restore from iCloud, then unlock (iOS only; Android restore is user-initiated)
3. **No local wallet, no cloud backup** — create a new wallet, then fire-and-forget upload to iCloud (iOS) or prompt the user to back up via Google Drive (Android)

### Dashboard
- Displays live balances for all configured EVM/BTC assets, refreshed every 30 s
- Also queries a Spark balance every 60 s, but Spark has no entry in `wdkConfigs.networks` (see [Networks and assets](#networks-and-assets)), so this query never resolves to a usable balance
- Shows the user's Ethereum address
- Retry button on bootstrap error
- Logout clears the session

### Send
- Asset picker (chip selector across all networks)
- Recipient address input with QR scan shortcut
- Amount input with basic validation
- Review → Confirm flow with biometric gate before broadcast
- Uses `useAccount.send()` from WDK core

### Receive
- Network picker lists Ethereum, Arbitrum, Polygon, Bitcoin, and Spark — only Ethereum and Bitcoin currently resolve to an address, since the others aren't wired up in `config/networks.ts` (see [Networks and assets](#networks-and-assets))
- QR code rendered via `react-native-qrcode-svg`
- One-tap copy to clipboard

### QR scanner
- `expo-camera` with runtime permission request
- Parses `ethereum:` / `bitcoin:` URI schemes and merchant payment QR codes (via `utils/merchantQR.ts`)
- Passes scanned address back to the Send screen

### Cashback
- **Available tab** — fetches the authenticated user's unredeemed UTL coupons from `GET /coupons`. Displays the USDT amount, UTL cashback amount, and creation date. Claim button calls `POST /coupons/claim` and shows a success alert.
- **Claimed tab** — fetches redeemed coupons from `GET /coupons/claimed`. Displays the USDT → UTL conversion, redemption date, and a truncated on-chain redemption tx hash.
- Tabs are lazy-loaded — each query only runs while its tab is active (`enabled: activeTab === ...`)

### Seed phrase / backup
- **View seed phrase** — biometric gate before revealing the 12-word grid
- **Copy to clipboard** with security warning
- **Upload to iCloud** (iOS) — re-authenticates with biometrics before upload
- **Upload to Google Drive** (Android) — biometric gate + Google OAuth sign-in before upload
- **Restore wallet** — import an existing seed phrase (normalises whitespace and casing)
- **Restore from Google Drive** (Android) — sign in with Google to recover a previous backup

### App lock
- `useAppLockBiometrics` hook and `AppLockOverlay` component enforce a biometric gate whenever the app returns to the foreground after being backgrounded
- Wraps `expo-local-authentication`; falls back gracefully on simulators

### Backend API integration (`utils/api.ts`)
Axios instance pre-configured with the backend base URL. Attaches the Cognito `id` token as a `Bearer` header on every request via a request interceptor.

- `getCoupons()` → `GET /coupons`
- `getClaimedCoupons()` → `GET /coupons/claimed`
- `postWalletBackup(ciphertext)` → `POST /wallets/backup`
- `putWalletAddress(address)` → `PUT /wallets/address`

`POST /coupons/claim` is called directly via `apiClient` from the cashback screen rather than through a wrapper in `utils/api.ts`.

### Cloud backup utility (`utils/cloudBackup.ts`)
Platform-aware wrapper around `@tetherto/wdk-backup-cloud-react-native`:
- `hasCloudBackup(walletId, accessToken?)` — check whether a backup file exists
- `createCloudBackup(mnemonic, walletId, accessToken?)` — encrypt and upload the mnemonic
- `restoreFromCloudBackup(walletId, accessToken?)` — download and decrypt; returns `null` on any error

On iOS, uses `ICloudProvider` (no token required). On Android, uses `GoogleDriveProvider` with a caller-supplied OAuth access token scoped to `drive.appdata`.

> **Note on Android auto-backup:** Unlike iOS, Google Drive requires an explicit OAuth prompt. The bootstrap hook does not attempt a silent cloud restore on Android; users initiate backup and restore manually from the Wallet Options screen.

## Networks and assets

`config/networks.ts` currently wires up two networks:

| Network | Chain | Assets |
|---|---|---|
| Ethereum Sepolia | EVM | ETH, USDT, UTL |
| Bitcoin Testnet | BTC (Blockbook) | BTC |

Arbitrum, Polygon, and Spark support has been scoped out to keep the exercise focused on the ETH-based cashback loop. `config/assets.ts` still defines `USDT_ARB_CONFIG`, `USDT_POL_CONFIG`, and `SPARK_CONFIG` as dead scaffolding for a possible future re-add — they resolve to the zero address by default and are filtered out of `EVM_ASSETS`, so they never reach the dashboard. The `receive.tsx` network picker and the Spark balance query in `(wallet)/index.tsx` still reference these networks by name; selecting them currently has no backing `wdkConfigs` entry.

## Tech Stack

- **Runtime:** React Native 0.81, Expo 54, Expo Router 6
- **State:** Zustand v5 (auth + wallet onboarding), TanStack React Query v5 (server state)
- **Forms:** React Hook Form + Zod
- **Styling:** NativeWind (Tailwind for RN)
- **Crypto:** @tetherto/wdk-react-native-core, wdk-wallet-evm, wdk-wallet-btc
- **Auth:** AWS Cognito (PKCE OAuth via expo-auth-session), expo-local-authentication
- **Testing:** Jest (jest-expo preset), @testing-library/react-native

## Testing

Unit tests live in `__tests__/` mirroring the source tree.

### Run tests

```bash
pnpm test               # run all tests
pnpm test --coverage    # generate coverage report
```

### Coverage

The project targets ≥ 90% statement coverage across all source files in:
- `hooks/`
- `stores/`
- `utils/`

Coverage reports are written to `coverage/` (excluded from git). View the HTML report at `coverage/lcov-report/index.html`.

### Coverage thresholds (`jest.config.js`)

```js
coverageThreshold: {
  global: { statements: 90, branches: 80, functions: 90, lines: 90 },
}
```

## Project structure

```
app/
  _layout.tsx               Root layout — WdkAppProvider + QueryClientProvider + AppLockOverlay
  index.tsx                 Auth gate redirect
  (auth)/
    index.tsx               Login screen (Cognito PKCE via useCognito)
  (wallet)/
    _layout.tsx             Wallet tab shell
    index.tsx               Dashboard (balances + actions + Cashback button)
    receive.tsx             Receive screen with QR
    cashback/
      index.tsx             Cashback coupon list + claim flow
    send/
      index.tsx             Send form
      confirm.tsx           Transaction review + biometric confirm
      scan.tsx              QR code scanner (merchant QR + ethereum:/bitcoin: URIs)
    wallet-setup/
      index.tsx             Seed phrase options menu
      backup.tsx            View / copy / iCloud or Google Drive upload
      restore.tsx           Restore wallet from seed phrase
      restore-cloud.tsx     Restore wallet from Google Drive (Android)

components/
  AppLockOverlay.tsx        Biometric gate overlay shown when app returns to foreground

config/
  networks.ts               WdkConfigs for Ethereum + Bitcoin (see Networks and assets)
  assets.ts                 AssetConfig definitions + BaseAsset instances

hooks/
  useAppLockBiometrics.ts   App lock hook — triggers biometric prompt on foreground resume
  useCognito.ts             Cognito PKCE auth hook (expo-auth-session)
  useBiometrics.ts          Thin wrapper over expo-local-authentication
  useGoogleAuth.ts          Google OAuth hook (expo-auth-session) for Android backup
  useWalletBootstrap.ts     Three-path bootstrap (local / cloud / new)
  useWalletData.ts          Wraps useWalletManager with safe create/restore helpers

stores/
  authStore.ts              userId + accessToken persisted to MMKV
  walletOnboardingStore.ts  Onboarding flow state persisted to MMKV

utils/
  api.ts                    Axios client for the NestJS backend (Bearer token injected automatically)
  merchantQR.ts             Parse merchant payment QR codes into address + amount
  balance.ts                Raw ↔ human decimal conversion helpers
  cloudBackup.ts            Platform-aware cloud backup/restore helpers (iCloud iOS, Google Drive Android)
```

## Getting started

### Prerequisites
- Node.js 20+
- pnpm 10+
- Xcode (iOS) or Android Studio (Android)
- Expo CLI (`pnpm add -g expo-cli`)

### Install

```bash
pnpm install
```

`postinstall` automatically runs the WDK worklet bundler and the bare-link script. If you need to re-run it manually:

```bash
pnpm run build:worklet
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

All variables are prefixed with `EXPO_PUBLIC_` and have safe public-testnet defaults. You only need to set the token contract addresses once the ERC-20 contracts are deployed.

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_ETHEREUM_RPC_URL` | `https://rpc.sepolia.org` | Ethereum Sepolia RPC |
| `EXPO_PUBLIC_BTC_BLOCKBOOK_URL` | `https://tbtc1.trezor.io` | Bitcoin Testnet Blockbook |
| `EXPO_PUBLIC_USDT_ETH_ADDRESS` | `0x000…` | USDT contract on Ethereum Sepolia |
| `EXPO_PUBLIC_UTL_ADDRESS` | `0x000…` | UTL utility token contract |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | — | Google OAuth Web client ID (Android Drive backup) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | — | Google OAuth Android client ID (Android Drive backup) |
| `EXPO_PUBLIC_COGNITO_DOMAIN` | — | Cognito Hosted UI domain, e.g. `https://your-pool.auth.us-east-1.amazoncognito.com` (see [SST/Cognito infra](../../README.md#infrastructure-aws-cognito-via-sst)) |
| `EXPO_PUBLIC_COGNITO_CLIENT_ID` | — | Cognito app client ID (public client, no secret) |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Base URL of the [backend API](../backend/README.md) |

#### Google Cloud Console setup (Android only)

To enable Google Drive backup on Android:

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com) and enable the **Google Drive API**
2. Under **APIs & Services → Credentials**, create:
   - An **OAuth 2.0 Web client ID** (for token exchange)
   - An **OAuth 2.0 Android client ID** with package name `com.spacedev.rnwdkexercise`
3. Add `rn-wdk-exercise://` as an authorized redirect URI on the Web client
4. Set both IDs in your `.env.local`

### Run

```bash
# iOS simulator
pnpm ios

# Android emulator
pnpm android
```

> **iCloud backup** requires a real iOS device signed in to an iCloud account. It is silently skipped on simulators.
>
> **Google Drive backup** requires a real Android device (or emulator with a Google account) and valid OAuth credentials configured in `.env.local`.

## Notes

- The WDK worklet bundle (`.wdk-bundle/`) must be committed or regenerated before running the app — the native runtime cannot bundle it on the fly.
- Wallet IDs are the user's verified Cognito email address. A single device can hold multiple wallets (one per email).
- Login requires a running Cognito User Pool (see [SST/Cognito infra](../../README.md#infrastructure-aws-cognito-via-sst)) and the cashback/wallet-backup screens require the [`apps/backend`](../backend/README.md) API to be reachable at `EXPO_PUBLIC_API_URL`.
- All network requests target public testnets. No real funds are at risk.
- ERC-20 tokens whose contract address is the zero address (`0x000…`) are automatically excluded from balance fetching — they appear in the dashboard with `—` and produce no errors. Set the corresponding `EXPO_PUBLIC_*_ADDRESS` env var to a real contract address to activate them.
