# Build the TypeScript backend, then run the compiled output on a slim runtime.
# Build context is the repo root (so the workspace lockfile is available).
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY backend ./backend
RUN npm run build --prefix backend

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist ./backend/dist
USER node
EXPOSE 5000
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
