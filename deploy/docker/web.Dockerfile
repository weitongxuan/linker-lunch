FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w packages/shared
RUN npm run build -w apps/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/docker/web.nginx.conf.template /etc/nginx/default.conf.template
COPY deploy/docker/web-render-conf.sh /docker-entrypoint.d/40-render-conf.sh
RUN chmod +x /docker-entrypoint.d/40-render-conf.sh
ENV API_UPSTREAM=http://localhost:4000
EXPOSE 80
