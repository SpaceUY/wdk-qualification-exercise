# rn-wdk-exercise

A React Native + Expo reference implementation of the [Tether WDK](https://github.com/tetherto/wdk), demonstrating a production-shaped multi-chain self-custody wallet with biometric authentication and cloud key backup (iCloud on iOS, Google Drive on Android).

## What's implemented

### Authentication
- Email-based login (email becomes the `userId` / wallet identifier)
- Session persisted to MMKV via Zustand so the user stays logged in across app restarts

### Wallet bootstrap
`useWalletBootstrap` runs automatically after login with three paths:
1. **Wallet exists on-device** — set active wallet ID and unlock
2. **No local wallet, cloud backup exists** — restore from iCloud, then unlock (iOS only; Android restore is user-initiated)
3. **No local wallet, no cloud backup** — create a new wallet, then fire-and-forget upload to iCloud (iOS) or prompt the user to back up via Google Drive (Android)

### Dashboard
- Displays live balances for all configured assets, refreshed every 30 s (60 s for Spark)
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
- Network picker (Ethereum, Arbitrum, Polygon, Bitcoin, Spark)
- QR code rendered via `react-native-qrcode-svg`
- One-tap copy to clipboard

### QR scanner
- `expo-camera` with runtime permission request
- Parses `ethereum:` / `bitcoin:` URI schemes
- Passes scanned address back to the Send screen

### Seed phrase / backup
- **View seed phrase** — biometric gate before revealing the 12-word grid
- **Copy to clipboard** with security warning
- **Upload to iCloud** (iOS) — re-authenticates with biometrics before upload
- **Upload to Google Drive** (Android) — biometric gate + Google OAuth sign-in before upload
- **Restore wallet** — import an existing seed phrase (normalises whitespace and casing)
- **Restore from Google Drive** (Android) — sign in with Google to recover a previous backup

### Cloud backup utility (`utils/cloudBackup.ts`)
Platform-aware wrapper around `@tetherto/wdk-backup-cloud-react-native`:
- `hasCloudBackup(walletId, accessToken?)` — check whether a backup file exists
- `createCloudBackup(mnemonic, walletId, accessToken?)` — encrypt and upload the mnemonic
- `restoreFromCloudBackup(walletId, accessToken?)` — download and decrypt; returns `null` on any error

On iOS, uses `ICloudProvider` (no token required). On Android, uses `GoogleDriveProvider` with a caller-supplied OAuth access token scoped to `drive.appdata`.

> **Note on Android auto-backup:** Unlike iOS, Google Drive requires an explicit OAuth prompt. The bootstrap hook does not attempt a silent cloud restore on Android; users initiate backup and restore manually from the Wallet Options screen.

## Networks and assets

| Network | Chain | Assets |
|---|---|---|
| Ethereum Sepolia | EVM (chainId 11155111) | ETH, USDT, UTL |
| Arbitrum Sepolia | EVM (chainId 421614) | USDT |
| Polygon Amoy | EVM (chainId 80002) | USDT |
| Bitcoin Testnet | BTC (Blockbook) | BTC |
| Spark Testnet | Spark | sBTC |

## Tech stack

| Layer | Library |
|---|---|
| Framework | Expo 54 / React Native 0.81 |
| Navigation | Expo Router v6 (file-based) |
| WDK | `@tetherto/wdk`, `wdk-react-native-core`, `wdk-wallet-evm/btc/spark` |
| State | Zustand + MMKV (persisted) |
| Data fetching | TanStack React Query v5 |
| Biometrics | `expo-local-authentication` |
| Cloud backup | `@tetherto/wdk-backup-cloud-react-native` + `react-native-cloud-storage` |
| Google OAuth | `expo-auth-session` + `expo-web-browser` |
| Styling | NativeWind (Tailwind for RN) |
| Toasts | `sonner-native` |
| QR | `react-native-qrcode-svg` / `expo-camera` |

## Project structure

```
app/
  _layout.tsx               Root layout — WdkAppProvider + QueryClientProvider
  index.tsx                 Auth gate redirect
  (auth)/
    index.tsx               Login screen
  (wallet)/
    _layout.tsx             Wallet tab shell
    index.tsx               Dashboard (balances + actions)
    receive.tsx             Receive screen with QR
    send/
      index.tsx             Send form
      confirm.tsx           Transaction review + biometric confirm
      scan.tsx              QR code scanner
    wallet-setup/
      index.tsx             Seed phrase options menu
      backup.tsx            View / copy / iCloud or Google Drive upload
      restore.tsx           Restore wallet from seed phrase
      restore-cloud.tsx     Restore wallet from Google Drive (Android)

config/
  networks.ts               WdkConfigs for all five networks
  assets.ts                 AssetConfig definitions + BaseAsset instances

hooks/
  useBiometrics.ts          Thin wrapper over expo-local-authentication
  useGoogleAuth.ts          Google OAuth hook (expo-auth-session) for Android backup
  useWalletBootstrap.ts     Three-path bootstrap (local / cloud / new)
  useWalletData.ts          Wraps useWalletManager with safe create/restore helpers

stores/
  authStore.ts              userId persisted to MMKV
  walletOnboardingStore.ts  Onboarding flow state persisted to MMKV

utils/
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
| `EXPO_PUBLIC_ARBITRUM_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | Arbitrum Sepolia RPC |
| `EXPO_PUBLIC_POLYGON_RPC_URL` | `https://rpc-amoy.polygon.technology` | Polygon Amoy RPC |
| `EXPO_PUBLIC_BTC_BLOCKBOOK_URL` | `https://tbtc1.trezor.io` | Bitcoin Testnet Blockbook |
| `EXPO_PUBLIC_USDT_ETH_ADDRESS` | `0x000…` | USDT contract on Ethereum Sepolia |
| `EXPO_PUBLIC_USDT_ARB_ADDRESS` | `0x000…` | USDT contract on Arbitrum Sepolia |
| `EXPO_PUBLIC_USDT_POL_ADDRESS` | `0x000…` | USDT contract on Polygon Amoy |
| `EXPO_PUBLIC_UTL_ADDRESS` | `0x000…` | UTL utility token contract |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | — | Google OAuth Web client ID (Android Drive backup) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | — | Google OAuth Android client ID (Android Drive backup) |

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
- Wallet IDs are the user's email address. A single device can hold multiple wallets (one per email).
- All network requests target public testnets. No real funds are at risk.
- ERC-20 tokens whose contract address is the zero address (`0x000…`) are automatically excluded from balance fetching — they appear in the dashboard with `—` and produce no errors. Set the corresponding `EXPO_PUBLIC_*_ADDRESS` env var to a real contract address to activate them.
