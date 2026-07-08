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
- Displays live balances for all configured EVM/BTC/Tron assets, refreshed every 30 s, plus Spark every 60 s
- Shows the user's Ethereum address
- Retry button on bootstrap error
- Logout clears the session
- Tron balance now resolves too — see [Networks and assets](#networks-and-assets) for the upstream address-validation bug this required patching

### Send
- Asset picker (chip selector across all networks)
- Recipient address input with QR scan shortcut
- Amount input with basic validation
- Review → Confirm flow with biometric gate before broadcast
- Uses `useAccount.send()` from WDK core

### Receive
- Network picker lists Ethereum, Arbitrum, Polygon, Bitcoin, Spark, and Tron — all six now resolve to a real address (see [Networks and assets](#networks-and-assets))
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

### Transaction history
- Lists on-chain transfers (sent/received, direction inferred from the WDK response, falling back to an address comparison) for Ethereum/USDT and Bitcoin/BTC, with tx hash, chain/token, timestamp, and formatted amount
- Data comes from the self-hosted WDK stack's `app-node` REST API (`GET /users/:userId/token-transfers`) — not from the wallet SDK itself, which has no history method (see `docs/wdk-sdk-spike.md`) — via a dedicated auth flow: `useAppNodeWalletSync` registers the wallet's ethereum/bitcoin addresses with app-node (idempotent, re-runs whenever a new address resolves), gated on a short-lived JWT minted by the backend's `GET /wdk-app-node/token` (a different auth scheme than the Cognito token used everywhere else — see [`apps/backend/README.md`](../backend/README.md#app-node-auth-bridge-get-wdk-app-nodetoken))
- Spark and Tron are excluded from history for now: Spark would additionally require deposit-address/identity-key placeholders unrelated to history (see the Spark deposit-flow note above); Tron addresses are now readable client-side (the `isValidAddress` bug below is fixed), but `useAppNodeWalletSync`/`history.tsx` haven't been extended to register/display a Tron address yet — that wiring is separate, still-unstarted work
- Only reachable when the self-hosted stack's `app-node` is running and reachable at `EXPO_PUBLIC_APP_NODE_URL` — same local-dev constraint as the BTC/Spark mainnet verification work documented in `docs/qualification-todo.md`

### Seed phrase / backup
- **View seed phrase** — biometric gate before revealing the 12-word grid
- **Copy to clipboard** with security warning
- **Upload to iCloud** (iOS) — re-authenticates with biometrics before upload
- **Upload to Google Drive** (Android) — biometric gate + Google OAuth sign-in before upload
- **Restore wallet** — import an existing seed phrase (normalises whitespace and casing)
- **Restore from Google Drive** (Android) — sign in with Google to recover a previous backup
- **Passphrase-encrypted before upload** — `components/PassphraseInput.tsx` collects (and, on
  backup, confirms) a user passphrase; `utils/seedEncryption.ts` derives an AES-256-GCM key from
  it via scrypt (N=2¹⁷, OWASP's minimum) and encrypts the mnemonic client-side before it ever
  reaches iCloud/Google Drive or the backend's `POST /wallets/backup`. The output is a versioned
  blob (version byte + salt + IV + ciphertext+tag) — old version bytes stay supported forever so
  existing backups keep decrypting even if the scrypt params are strengthened later. A weak/short
  passphrase is rejected client-side (`validatePassphraseStrength`, min 8 chars, rejects
  low-entropy and common passphrases) before encryption ever runs.

### App lock
- `useAppLockBiometrics` hook and `AppLockOverlay` component enforce a biometric gate whenever the app returns to the foreground after being backgrounded
- Wraps `expo-local-authentication`; fails closed — if biometrics are unavailable (no hardware or nothing enrolled) or the prompt doesn't succeed, `unlock()` denies access and the app stays locked

### Backend API integration (`utils/api.ts`)
Axios instance pre-configured with the backend base URL. Attaches the Cognito `id` token as a `Bearer` header on every request via a request interceptor.

- `getCoupons()` → `GET /coupons`
- `getClaimedCoupons()` → `GET /coupons/claimed`
- `postWalletBackup(ciphertext)` → `POST /wallets/backup`
- `putWalletAddress(address)` → `PUT /wallets/address`
- `getAppNodeToken()` → `GET /wdk-app-node/token` — mints the separate app-node JWT (see Transaction history above)

`POST /coupons/claim` is called directly via `apiClient` from the cashback screen rather than through a wrapper in `utils/api.ts`.

### App-node integration (`utils/appNodeApi.ts`)
A separate Axios instance pointed at `EXPO_PUBLIC_APP_NODE_URL` (the self-hosted WDK stack's `app-node`, not this project's own backend) — no shared interceptor state, since its Bearer token (from `getAppNodeToken()`) is minted fresh per call rather than cached:

- `connectAppNode()` → `POST /api/v1/connect` (idempotent shard resolution)
- `getAppNodeUserWallet()` → `GET /api/v1/wallets?type=user`
- `createAppNodeWallet(addresses)` / `updateAppNodeWalletAddresses(walletId, addresses)` → `POST` / `PATCH /api/v1/wallets`
- `getUserTokenTransfers(userId, opts)` → `GET /api/v1/users/:userId/token-transfers`

`hooks/useAppNodeWalletSync.ts` orchestrates the first three (create-if-missing, patch-if-a-known-address-is-missing) and `hooks/useTransactionHistory.ts` wraps the last one in a React Query hook.

### Cloud backup utility (`utils/cloudBackup.ts`)
Platform-aware wrapper around `@tetherto/wdk-backup-cloud-react-native`:
- `hasCloudBackup(walletId, accessToken?)` — check whether a backup file exists
- `createCloudBackup(mnemonic, walletId, accessToken?)` — encrypt and upload the mnemonic
- `restoreFromCloudBackup(walletId, accessToken?)` — download and decrypt; returns `null` on any error

On iOS, uses `ICloudProvider` (no token required). On Android, uses `GoogleDriveProvider` with a caller-supplied OAuth access token scoped to `drive.appdata`.

> **Note on Android auto-backup:** Unlike iOS, Google Drive requires an explicit OAuth prompt. The bootstrap hook does not attempt a silent cloud restore on Android; users initiate backup and restore manually from the Wallet Options screen.

## Networks and assets

`config/networks.ts` wires up six networks:

| Network | Chain | Assets | Notes |
|---|---|---|---|
| Ethereum Sepolia | EVM | ETH, USDT, UTL | Testnet |
| Arbitrum Sepolia | EVM | USDT | Testnet. Wired up, but no test-USDT contract is deployed here yet (`EXPO_PUBLIC_USDT_ARB_ADDRESS` unset) — the asset resolves to the zero address, so it's filtered out of the dashboard's balance list and any real send would fail; the network/address layer itself works |
| Polygon Amoy | EVM | USDT | Same situation as Arbitrum above — wired up, no test-USDT contract deployed (`EXPO_PUBLIC_USDT_POL_ADDRESS`) |
| Bitcoin | BTC (Blockbook) | BTC | **Mainnet** — real funds, per project requirement |
| Spark | Spark (SparkScan) | sBTC | **Mainnet** — same real-funds requirement as Bitcoin (Spark is a Bitcoin L2). Requires `EXPO_PUBLIC_SPARK_SCAN_API_KEY`. Receive shows a real address; there is no deposit/claim UI, so crediting funds into a Spark wallet isn't possible from this app (see [`infra/wdk-stack`](../../infra/wdk-stack/README.md)) |
| Tron | TVM | USDT (TRC20) | Nile testnet. Fixed — see the patch note below |

Arbitrum and Polygon were previously unwired despite `config/assets.ts` already defining `USDT_ARB_CONFIG`/`USDT_POL_CONFIG` for them, and `wdk.config.js`'s worklet bundle already registering wallet managers for both (keyed by `blockchain: 'arbitrum'`/`'polygon'`) — the only missing piece was the runtime `wdkConfigs.networks` entries in `config/networks.ts`, now added. Full fund-flow verification (an actual send) still needs a disposable test-USDT contract deployed on each testnet, which needs a deployer wallet funded with testnet ETH/MATIC — not done as part of this fix.

### Fixed — Tron addresses were rejected everywhere

`@tetherto/wdk-react-native-core`'s address validator (`isValidAddress` in `utils/typeGuards.ts`/`typeGuards.js`) only recognized Ethereum, Spark, and Bitcoin formats — there was no Tron case, so every syntactically valid Tron address threw `"Address from worklet has invalid format"` and was silently dropped. This was an upstream library bug, not something introduced by this project. Fixed via `pnpm patch` (`patches/@tetherto__wdk-react-native-core@1.0.0.patch`), adding an `isTronAddress` check (Tron's `^T[1-9A-HJ-NP-Za-km-z]{33}$` Base58 format) to both the compiled `dist/` output and the `src/` TypeScript that Metro actually bundles (the package's `"react-native"` field points there, not `dist/`) — both needed patching since Jest and Metro resolve the package differently. The patch persists across `pnpm install` via `pnpm.patchedDependencies` in the root `package.json`.

## Tech Stack

- **Runtime:** React Native 0.81, Expo 54, Expo Router 6
- **State:** Zustand v5 (auth + wallet onboarding), TanStack React Query v5 (server state)
- **Forms:** React Hook Form + Zod
- **Styling:** NativeWind (Tailwind for RN)
- **Crypto:** @tetherto/wdk-react-native-core, wdk-wallet-evm, wdk-wallet-btc, wdk-wallet-spark, wdk-wallet-tron
- **Auth:** AWS Cognito (PKCE OAuth via expo-auth-session), expo-local-authentication
- **Testing:** Jest (jest-expo preset), @testing-library/react-native

## Testing

Unit tests live in `__tests__/` mirroring the source tree.

### Run tests

```bash
pnpm test               # run all tests
pnpm test --coverage    # generate coverage report
```

### End-to-end (Maestro)

```bash
pnpm test:e2e            # maestro test .maestro
```

Flows in `.maestro/flows/` (`login`, `dashboard`, `receive`, `cashback`, `logout`) drive the app
on a real simulator/emulator or device — see [`.maestro/README.md`](.maestro/README.md) for setup
and prerequisites. Not run as part of the Jest suite above, and not wired into CI.

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
    history.tsx             Transaction history (ETH/BTC, via app-node)
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
  PassphraseInput.tsx       Passphrase entry (+ optional confirm) for backup encryption (see Seed phrase / backup)

config/
  networks.ts               WdkConfigs for Ethereum, Arbitrum, Polygon, Bitcoin, Spark, and Tron (see Networks and assets)
  assets.ts                 AssetConfig definitions + BaseAsset instances

hooks/
  useAppLockBiometrics.ts   App lock hook — triggers biometric prompt on foreground resume
  useCognito.ts             Cognito PKCE auth hook (expo-auth-session)
  useBiometrics.ts          Thin wrapper over expo-local-authentication
  useGoogleAuth.ts          Google OAuth hook (expo-auth-session) for Android backup
  useWalletBootstrap.ts     Three-path bootstrap (local / cloud / new)
  useWalletData.ts          Wraps useWalletManager with safe create/restore helpers
  useAppNodeWalletSync.ts   Registers ethereum/bitcoin addresses with app-node (see Transaction history)
  useTransactionHistory.ts  React Query wrapper over app-node's token-transfers endpoint

stores/
  authStore.ts              userId + accessToken persisted to MMKV
  walletOnboardingStore.ts  Onboarding flow state persisted to MMKV

utils/
  api.ts                    Axios client for the NestJS backend (Bearer token injected automatically)
  appNodeApi.ts             Axios client for the self-hosted WDK stack's app-node (separate auth/base URL)
  merchantQR.ts             Parse merchant payment QR codes into address + amount
  balance.ts                Raw ↔ human decimal conversion helpers
  cloudBackup.ts            Platform-aware cloud backup/restore helpers (iCloud iOS, Google Drive Android)
  seedEncryption.ts         Passphrase-based AES-256-GCM encryption for backups (see Seed phrase / backup)
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
| `EXPO_PUBLIC_ARBITRUM_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | Arbitrum Sepolia RPC (no API key needed) |
| `EXPO_PUBLIC_USDT_ARB_ADDRESS` | `0x000…` | USDT contract on Arbitrum Sepolia — unset by default, no test contract deployed yet |
| `EXPO_PUBLIC_POLYGON_RPC_URL` | `https://rpc-amoy.polygon.technology` | Polygon Amoy RPC (no API key needed) |
| `EXPO_PUBLIC_USDT_POL_ADDRESS` | `0x000…` | USDT contract on Polygon Amoy — unset by default, no test contract deployed yet |
| `EXPO_PUBLIC_BTC_BLOCKBOOK_URL` | `https://blockbook.btc.zelcore.io/api` | Bitcoin **mainnet** Blockbook (real funds — `btc1.trezor.io` is Cloudflare-blocked for API requests) |
| `EXPO_PUBLIC_TRON_RPC_URL` | `https://nile.trongrid.io` | Tron Nile testnet RPC (no API key needed; only mainnet requires one) |
| `EXPO_PUBLIC_USDT_TRON_ADDRESS` | Tron mainnet USDT contract (placeholder) | USDT-TRC20 contract on Tron Nile — set to a real Nile test-token contract (no canonical one exists; see [`infra/wdk-stack`](../../infra/wdk-stack/README.md)) |
| `EXPO_PUBLIC_SPARK_SCAN_API_KEY` | — | SparkScan API key, required for Spark (**mainnet**) balance/history |
| `EXPO_PUBLIC_USDT_ETH_ADDRESS` | `0x000…` | USDT contract on Ethereum Sepolia |
| `EXPO_PUBLIC_UTL_ADDRESS` | `0x000…` | UTL utility token contract |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | — | Google OAuth Android client ID (Android Drive backup) |
| `EXPO_PUBLIC_COGNITO_DOMAIN` | — | Cognito Hosted UI domain, e.g. `https://your-pool.auth.us-east-1.amazoncognito.com` (see [SST/Cognito infra](../../README.md#infrastructure-aws-cognito-via-sst)) |
| `EXPO_PUBLIC_COGNITO_CLIENT_ID` | — | Cognito app client ID (public client, no secret) |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3001` | Base URL of the [backend API](../backend/README.md) — 3001 locally, since the self-hosted WDK stack's app-node owns port 3000 |
| `EXPO_PUBLIC_APP_NODE_URL` | `http://localhost:3000` | Base URL of the self-hosted WDK stack's `app-node` (see [`infra/wdk-stack`](../../infra/wdk-stack/README.md)), used directly for wallet registration + transaction history |

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

### Building for the App Store / Google Play (EAS)

`eas.json` defines `development`/`preview`/`production` build profiles and a `production` submit
profile (see the root [deployment guide](../../docs/deployment-guide.md) for the full store
release runbook). Most of its `EXPO_PUBLIC_*` values are `REPLACE_ME_*` placeholders until the
corresponding infra (Cognito, backend, app-node, deployed contracts) exists — fill them in per
profile before building:

```bash
npx eas login
npx eas build --platform all --profile production
npx eas submit --platform all --latest
```

## Notes

- The WDK worklet bundle (`.wdk-bundle/`) must be committed or regenerated before running the app — the native runtime cannot bundle it on the fly.
- Wallet IDs are the user's verified Cognito email address. A single device can hold multiple wallets (one per email).
- Login requires a running Cognito User Pool (see [SST/Cognito infra](../../README.md#infrastructure-aws-cognito-via-sst)) and the cashback/wallet-backup screens require the [`apps/backend`](../backend/README.md) API to be reachable at `EXPO_PUBLIC_API_URL`. The transaction history screen additionally requires the self-hosted [`infra/wdk-stack`](../../infra/wdk-stack/README.md)'s `app-node` reachable at `EXPO_PUBLIC_APP_NODE_URL`.
- **Bitcoin and Spark run on mainnet — real funds are at risk on those two networks** (a deliberate project requirement; Spark runs on top of Bitcoin, so it carries the same requirement). Ethereum and Tron stay on public testnets (Sepolia / Nile). Double-check recipient addresses and amounts before sending BTC or Spark from this app.
- ERC-20 tokens whose contract address is the zero address (`0x000…`) are automatically excluded from balance fetching — they appear in the dashboard with `—` and produce no errors. Set the corresponding `EXPO_PUBLIC_*_ADDRESS` env var to a real contract address to activate them.
