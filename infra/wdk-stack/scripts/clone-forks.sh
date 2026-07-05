#!/usr/bin/env bash
# Clones the 5 forked WDK repos needed by the core pipeline (docs/wdk-self-hosted-stack/01-core-pipeline.md)
# into ./vendor/ at pinned refs. Safe to re-run — skips repos that already exist.
#
# Repo URLs/refs are read from .env (see .env.example). Requires SSH access to the SpaceUY org.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

mkdir -p vendor

clone_one() {
  local name="$1" repo_var="$2" ref_var="$3"
  local repo="${!repo_var:-}"
  local ref="${!ref_var:-main}"

  if [ -z "$repo" ]; then
    echo "Skipping $name: $repo_var is not set in .env" >&2
    return
  fi

  if [ -d "vendor/$name/.git" ]; then
    echo "vendor/$name already exists, skipping (delete it to re-clone)"
    return
  fi

  echo "Cloning $name @ $ref ..."
  git clone --branch "$ref" --depth 1 "$repo" "vendor/$name"

  # Only wdk-indexer-wrk-btc ships its own .dockerignore upstream — every other fork needs one
  # so real config/secrets never leak into the build context (see doc 01-core-pipeline.md §2).
  if [ ! -f "vendor/$name/.dockerignore" ]; then
    cp dockerfiles/dockerignore-template "vendor/$name/.dockerignore"
  fi
}

clone_one wdk-indexer-wrk-evm      WDK_INDEXER_EVM_REPO       WDK_INDEXER_EVM_REF
clone_one wdk-indexer-processor-wrk WDK_INDEXER_PROCESSOR_REPO WDK_INDEXER_PROCESSOR_REF
clone_one wdk-data-shard-wrk       WDK_DATA_SHARD_REPO        WDK_DATA_SHARD_REF
clone_one wdk-ork-wrk              WDK_ORK_REPO               WDK_ORK_REF
clone_one wdk-app-node             WDK_APP_NODE_REPO          WDK_APP_NODE_REF
clone_one wdk-indexer-wrk-btc      WDK_INDEXER_BTC_REPO       WDK_INDEXER_BTC_REF
clone_one wdk-indexer-wrk-spark    WDK_INDEXER_SPARK_REPO     WDK_INDEXER_SPARK_REF
clone_one wdk-indexer-wrk-tron     WDK_INDEXER_TRON_REPO      WDK_INDEXER_TRON_REF

echo "Done. Vendored repos are in ./vendor/ (gitignored, not committed)."
