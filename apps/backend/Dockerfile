FROM node:24.15.0-alpine

ENV CI=true

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

USER node

WORKDIR /home/node

COPY --chown=node:node package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile --ignore-workspace

COPY --chown=node:node . .

RUN pnpm run build

EXPOSE 3000

CMD ["dumb-init", "node", "dist/main"]
