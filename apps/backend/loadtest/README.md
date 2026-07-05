# Backend load testing (Artillery)

Local/manual suite only — not wired into CI. See
`docs/superpowers/specs/2026-07-04-backend-load-testing-design.md` for the full design and rationale.

## What this covers

Five real, authenticated endpoints with no blockchain side effects:
`GET /coupons`, `GET /coupons/claimed`, `PUT /wallets/address`, `POST /wallets/backup`,
`GET /wdk-app-node/token`.

**Deliberately excluded**: `POST /coupons/claim` — it triggers a real on-chain Sepolia
transfer from the treasury wallet. Running that under load would spam Sepolia and drain
the treasury wallet for no useful signal.

## Preconditions

1. The backend stack running via Docker Compose, reachable at `http://localhost:3000`:
   ```bash
   cd apps/backend
   docker compose up --build
   ```
2. A test Cognito user (the same one the Maestro suite uses) with:
   - `USER_PASSWORD_AUTH` enabled on its app client
   - No MFA configured
3. Env vars set before running:
   - `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` — the test user's credentials
   - `COGNITO_CLIENT_ID` — the Cognito app client ID (the same public client the RN app
     uses — see `EXPO_PUBLIC_COGNITO_CLIENT_ID` in `apps/rn-wdk-exercise/.env.example`)
   - `COGNITO_REGION` — defaults to `us-east-1` if unset

## Run

```bash
cd apps/backend
TEST_USER_EMAIL=<test-user-email> \
TEST_USER_PASSWORD=<test-user-password> \
COGNITO_CLIENT_ID=<cognito-app-client-id> \
pnpm test:load
```

Artillery mints one real Cognito token before the run and reuses it for every request
across every virtual user — only one real Cognito API call happens per run, regardless
of load.

## Reading the results

The default run prints a live latency/error-rate summary to the terminal. For a nicer
HTML report:

```bash
npx artillery run --output loadtest/report.json loadtest/artillery.yml
npx artillery report loadtest/report.json
```

## Tuning

The scenario's two phases (30s warm-up @ 2 virtual users/sec, 60s sustained @ 10/sec, in
`loadtest/artillery.yml`) are a first, deliberately modest baseline — there's no prior
load-test data for this backend to tune against yet. Adjust `arrivalRate`/`duration` once
you have a feel for how the stack behaves.

## Out of scope

`POST /coupons/claim` (real on-chain side effect), pass/fail thresholds (no baseline
exists yet), CI wiring (needs a real Cognito user and a real running stack).
