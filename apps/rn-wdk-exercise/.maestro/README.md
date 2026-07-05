# E2E golden-path smoke tests (Maestro)

Local/manual suite only — not wired into CI. See
`docs/superpowers/specs/2026-07-04-maestro-e2e-design.md` for the full design and rationale.

## Preconditions

1. Local stack running and reachable from the simulator/emulator:
   - `apps/backend` (`EXPO_PUBLIC_API_URL`)
   - self-hosted WDK `app-node` (`EXPO_PUBLIC_APP_NODE_URL`)
2. A test Cognito user exists and has **logged into the app at least once already**
   (so `seed-coupon.js`'s user lookup succeeds — the backend only creates a `users`
   record on first login).
3. The backend's treasury wallet (`blockchain.config`) is funded with Sepolia UTL —
   `cashback.yaml`'s claim step triggers a real on-chain transfer and waits for
   1 confirmation.
4. A dev build installed on a simulator/emulator (`pnpm ios` / `pnpm android` once).
5. [Maestro CLI](https://maestro.mobile.dev) installed.

## Seed a coupon before running `cashback.yaml`

```bash
node apps/backend/scripts/seed-coupon.js <test-user-email> [usdt_amount]
```

## Run

```bash
# from apps/rn-wdk-exercise
APP_ID=com.spacedev.rn-wdk-exercise \
TEST_USER_EMAIL=<test-user-email> \
TEST_USER_PASSWORD=<test-user-password> \
pnpm test:e2e
```

`APP_ID` is the iOS bundle identifier (`com.spacedev.rn-wdk-exercise`) or Android
package name (`com.spacedev.rnwdkexercise`), depending on which simulator/emulator
you're targeting.

## Out of scope (see design doc)

Send/Confirm, app lock / biometric gates, seed phrase backup/restore, QR scanner.
