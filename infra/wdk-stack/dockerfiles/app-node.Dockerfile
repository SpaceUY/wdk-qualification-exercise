# syntax=docker/dockerfile:1.10
#
# Modeled on wdk-indexer-wrk-btc/Dockerfile. See docs/wdk-self-hosted-stack/01-core-pipeline.md §2.
# HTTP server — EXPOSE 3000 instead of the worker default 8080.
#
# Runtime stage uses bookworm-slim, NOT distroless: every service here extends
# @tetherto/tether-wrk-base, which eagerly requires a hyperdb/rocksdb-native code path
# regardless of the configured lookupEngine, needing libatomic.so.1 at runtime — distroless
# lacks it and has no package manager to add it. bookworm-slim has apt.

ARG NODE_VERSION=22.18.0
ARG DEPS_IMAGE=node:${NODE_VERSION}-bookworm-slim

FROM ${DEPS_IMAGE} AS deps
ENV HUSKY=0 \
    NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates git openssh-client python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=PAT_TOKEN,required=false \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    set -eu; \
    git config --global credential.helper \
      '!f() { echo username=x-access-token; echo "password=$(cat /run/secrets/PAT_TOKEN 2>/dev/null || true)"; }; f'; \
    git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"; \
    git config --global --add url."https://github.com/".insteadOf "git+ssh://git@github.com/"; \
    git config --global --add url."https://github.com/".insteadOf "git@github.com:"; \
    npm ci --omit=dev --no-audit --no-fund; \
    rm -f /root/.gitconfig

FROM ${DEPS_IMAGE} AS app
WORKDIR /app
COPY . .
RUN chmod +x setup-config.sh && ./setup-config.sh
COPY --from=deps /app/node_modules ./node_modules
COPY --from=entrypoints app-node.entrypoint.js ./docker-entrypoint.js
COPY --from=entrypoints lib ./entrypoint-lib
RUN mkdir -p /app/sec /app/status /app/store \
 && chown -R 65532:65532 /app

FROM ${DEPS_IMAGE} AS runtime
ARG BUILD_VERSION=dev
ARG BUILD_REVISION=unknown
ARG BUILD_DATE
RUN apt-get update \
 && apt-get install -y --no-install-recommends libatomic1 \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=app /app /app
USER 65532:65532
EXPOSE 3000
LABEL org.opencontainers.image.title="wdk-app-node" \
      org.opencontainers.image.description="WDK App Node — stateless Fastify REST/JWT gateway" \
      org.opencontainers.image.source="https://github.com/SpaceUY/wdk-app-node" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Tether" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}"
ENTRYPOINT ["node", "/app/docker-entrypoint.js"]
CMD []
