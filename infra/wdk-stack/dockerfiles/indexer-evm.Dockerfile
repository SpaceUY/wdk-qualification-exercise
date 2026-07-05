# syntax=docker/dockerfile:1.10
#
# Modeled on wdk-indexer-wrk-btc/Dockerfile (the only fork with a real production Dockerfile).
# See docs/wdk-self-hosted-stack/01-core-pipeline.md §2. The `entrypoints` build context (see
# docker-compose.yml's `additional_contexts`) supplies our own docker-entrypoint.js — the
# vendored repo itself stays an unmodified clone of upstream.
#
# Unlike the other 4 services, this one depends on a genuinely private package
# (@tetherto/wdk-indexer-wrk-base, forked to SpaceUY/wdk-indexer-wrk-base). Auth uses the
# BuildKit SSH agent forward (`docker compose build`'s `ssh: [default]`), reusing whatever
# SSH access is already loaded in the host's ssh-agent — no separate PAT needed.
#
# Runtime stage uses bookworm-slim, NOT distroless: @tetherto/wdk-indexer-wrk-base's hyperdb
# backend (rocksdb-native) needs libatomic.so.1 at runtime, which distroless/nodejs22-debian12
# lacks and has no package manager to add. bookworm-slim has apt, so we install it there
# directly instead of hand-copying an arch-specific .so file out of the deps stage.

ARG NODE_VERSION=22.18.0
ARG DEPS_IMAGE=node:${NODE_VERSION}-bookworm-slim

############################
# Stage 1 — deps
############################
FROM ${DEPS_IMAGE} AS deps

ENV HUSKY=0 \
    NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      git \
      openssh-client \
      python3 \
      make \
      g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json .npmrc ./

RUN --mount=type=ssh \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    set -eu; \
    mkdir -p -m 0700 /root/.ssh; \
    ssh-keyscan -t rsa,ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null; \
    git config --global url."ssh://git@github.com/".insteadOf "https://github.com/"; \
    npm ci --omit=dev --no-audit --no-fund; \
    rm -f /root/.gitconfig

############################
# Stage 2 — app assembly
############################
FROM ${DEPS_IMAGE} AS app

WORKDIR /app

COPY . .
RUN chmod +x setup-config.sh && ./setup-config.sh
COPY --from=deps /app/node_modules ./node_modules
COPY --from=entrypoints indexer-evm.entrypoint.js ./docker-entrypoint.js
COPY --from=entrypoints lib ./entrypoint-lib

RUN mkdir -p /app/sec /app/status /app/store \
 && chown -R 65532:65532 /app

############################
# Stage 3 — runtime (bookworm-slim — see note above on why not distroless)
############################
FROM ${DEPS_IMAGE} AS runtime

ARG BUILD_VERSION=dev
ARG BUILD_REVISION=unknown
ARG BUILD_DATE

RUN apt-get update \
 && apt-get install -y --no-install-recommends libatomic1 \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY --from=app /app /app

USER 65532:65532
EXPOSE 8080

LABEL org.opencontainers.image.title="wdk-indexer-wrk-evm" \
      org.opencontainers.image.description="WDK Ethereum/USDT-ERC20 indexer worker (proc + api)" \
      org.opencontainers.image.source="https://github.com/SpaceUY/wdk-indexer-wrk-evm" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Tether" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENTRYPOINT ["node", "/app/docker-entrypoint.js"]
CMD []
