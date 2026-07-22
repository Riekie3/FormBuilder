# Built from the monorepo root: `docker build -f docker/api.Dockerfile .`
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --workspaces --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run prisma:generate
RUN npm run build:api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]
