# syntax=docker/dockerfile:1
FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json .env.example ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile || true

RUN pnpm -w build || true

ENV NODE_ENV=production

CMD ["pnpm", "-w", "dev"]

