# syntax=docker/dockerfile:1

# WIFI QUEST - Frontend (Vite + React 19 + Tailwind v4)
# Build -> estáticos servidos por nginx.

# ---------- Etapa de build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Manifiestos del monorepo (npm workspaces) para poder hacer `npm ci`
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

# Código del frontend
COPY frontend ./frontend

# URL pública del backend que el cliente usa para /api. Se fija en tiempo
# de build (import.meta.env.VITE_API_URL). Se pasa como build arg desde compose.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm --workspace=frontend run build

# ---------- Etapa de runtime ----------
FROM nginx:alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
