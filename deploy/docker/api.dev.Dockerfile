FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

EXPOSE 4000
CMD ["sh", "/app/deploy/docker/api.dev-entrypoint.sh"]
