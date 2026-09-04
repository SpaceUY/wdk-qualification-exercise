# bookworm-slim (glibc), NOT alpine (musl): @tetherto/wdk-wallet-evm pulls in
# sodium-universal -> sodium-native, whose Node.js entry is a plain
# `require('sodium-native')` with no JS fallback. sodium-native ships a prebuilt
# linux-x64 (glibc) binding but no linux-x64-musl one, and this image has no
# compiler to build it from source either way — so it crashes on first import
# under alpine. Same fix infra/wdk-stack's own Dockerfiles already use for a
# different native WDK dependency (see their bookworm-slim comments).
FROM node:24.15.0-bookworm-slim

ENV CI=true

RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

USER node

WORKDIR /home/node

# DocumentDB requires TLS by default; MONGODB_URI's tlsCAFile=global-bundle.pem resolves
# against this WORKDIR, so the file must live here.
RUN curl -sS -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

COPY --chown=node:node package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile --ignore-workspace

COPY --chown=node:node . .

RUN pnpm run build

EXPOSE 3000

CMD ["dumb-init", "node", "dist/main"]
