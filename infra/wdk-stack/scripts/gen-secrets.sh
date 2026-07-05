#!/usr/bin/env bash
# Generates the shared hRPC capability/crypto secrets and the app-node JWT secret into .env,
# without touching any other value already set there. Safe to re-run — only fills blanks.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

set_if_blank() {
  local key="$1"
  local current
  current="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- || true)"
  if [ -n "$current" ]; then
    echo "$key already set, leaving as-is"
    return
  fi
  local value
  value="$(openssl rand -hex 32)"
  if grep -qE "^${key}=" .env; then
    # Portable in-place edit for both GNU and BSD sed
    sed -i.bak "s|^${key}=.*|${key}=${value}|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
  echo "Generated $key"
}

set_if_blank WDK_CAPABILITY
set_if_blank WDK_CRYPTO_KEY
set_if_blank JWT_SECRET

echo "Done. Review .env, fill in GITHUB_PAT/SEPOLIA_RPC_URL, then run scripts/clone-forks.sh."
