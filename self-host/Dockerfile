FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY app ./app
COPY self-host ./self-host
RUN pnpm exec vite build --config self-host/vite.config.ts
FROM node:22-slim
WORKDIR /app
COPY --from=build /app/self-host/public ./public
COPY self-host/server.mjs self-host/google-auth.mjs ./
RUN mkdir data && chown -R node:node /app
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--env-file-if-exists=.env", "server.mjs"]
