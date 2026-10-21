# syntax=docker/dockerfile:1

# WIFI QUEST - Backend (Hono + motor determinista Nivel 1/2)
#
# El build (esbuild) genera dist/index.mjs AUTOCONTENIDO: incluye hono,
# dotenv y @hono/node-server dentro del bundle. En runtime solo hace falta
# Node y los módulos nativos del sistema (fs, path, os, crypto).

# ---------- Etapa de build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Manifiestos del monorepo (npm workspaces) para poder hacer `npm ci`
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

# Código del backend y compilación (esbuild -> dist/index.mjs)
COPY backend ./backend
RUN npm --workspace=backend run build

# ---------- Etapa de runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# El bundle es autocontenido: no requiere node_modules
COPY --from=build /app/backend/dist/index.mjs ./dist/index.mjs

EXPOSE 3000
CMD ["node", "dist/index.mjs"]
