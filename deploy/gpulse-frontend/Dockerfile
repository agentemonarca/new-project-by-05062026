# G-Pulse SPA — build desde la raíz del monorepo (workspace @ai-genesis/config).
# docker build -f deploy/gpulse-frontend/Dockerfile -t gpulse-web:latest .
# docker run -p 8080:80 gpulse-web:latest
#
# Vite (build-time): docker build --build-arg VITE_API_URL=https://api.tudominio.com ...

FROM node:22-bookworm-slim AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

ARG VITE_API_URL=
ARG VITE_BACKEND_URL=
ARG VITE_GENESIS_BACKOFFICE_HOME=
ARG VITE_GENESIS_DASHBOARD_HOME=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_GENESIS_BACKOFFICE_HOME=$VITE_GENESIS_BACKOFFICE_HOME
ENV VITE_GENESIS_DASHBOARD_HOME=$VITE_GENESIS_DASHBOARD_HOME

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gpulse ./apps/gpulse
COPY packages/config ./packages/config

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-genesis/gpulse build

FROM nginx:1.27-alpine
COPY deploy/gpulse-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/gpulse/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
