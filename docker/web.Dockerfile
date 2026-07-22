# Built from the monorepo root: `docker build -f docker/web.Dockerfile .`
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --workspaces --include-workspace-root

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build:web

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
