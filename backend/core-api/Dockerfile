# Genesis / G-Pulse core-api — producción (AWS ECS/Fargate, EC2, EKS)
# Build: docker build -t g-pulse-core-api:latest .
# Run:  docker run --env-file .env.production -p 5050:5050 g-pulse-core-api:latest

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.db.json tsconfig.compensation.json ./
COPY src ./src

RUN npm run build:db && npm run build:compensation

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY src ./src

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nodejs \
  && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=50s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5050)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
