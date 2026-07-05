# syntax=docker/dockerfile:1.10
#
# wdk-indexer-wrk-tron does not ship a production Dockerfile upstream, so we create one with
# config generation going through the shared entrypoint-lib pattern (see
# docs/wdk-self-hosted-stack/01-core-pipeline.md §3) instead of a bespoke entrypoint.
#
# Build-auth: every git-sourced dependency in this repo's package-lock.json is publicly
# cloneable EXCEPT @tetherto/wdk-indexer-wrk-base (confirmed private — anonymous clone fails).
# This repo pins that dependency at the same commit that wdk-indexer-wrk-evm already builds
# successfully from a SpaceUY mirror — see docs/wdk-self-hosted-stack/02-multi-chain-expansion.md's
# reconciliation note. We redirect only that one dependency via BuildKit SSH-agent forwarding;
# no PAT_TOKEN needed for this image (every other dependency resolves publicly).

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
    git config --global url."ssh://git@github.com/SpaceUY/wdk-indexer-wrk-base.git".insteadOf "ssh://git@github.com/tetherto/wdk-indexer-wrk-base.git"; \
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
COPY --from=entrypoints indexer-tron.entrypoint.js ./docker-entrypoint.js
COPY --from=entrypoints lib ./entrypoint-lib

RUN mkdir -p /app/sec /app/status /app/store \
 && chown -R 65532:65532 /app

############################
# Stage 3 — runtime (bookworm-slim, not distroless — needs libatomic.so.1)
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

LABEL org.opencontainers.image.title="wdk-indexer-wrk-tron" \
      org.opencontainers.image.description="WDK Tron USDT-TRC20 indexer worker (proc + api)" \
      org.opencontainers.image.source="https://github.com/SpaceUY/wdk-indexer-wrk-tron" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Tether" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENTRYPOINT ["node", "/app/docker-entrypoint.js"]
CMD []
