FROM node:24.15.0-alpine

ENV CI=true

RUN apk add --no-cache dumb-init curl

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
