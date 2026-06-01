# Build the SPA with Vite, then serve the static bundle via nginx, which also
# reverse-proxies the API/WS/config routes to the backend service.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci
COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
