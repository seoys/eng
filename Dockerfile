# Stage 1 — build the Svelte frontend into static assets
FROM node:22-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2 — install server deps and assemble the runtime image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=web-build /app/web/dist ./public

ENV STATIC_DIR=./public
ENV PORT=9999
EXPOSE 9999

CMD ["node", "src/server.js"]
