FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "apps/web", "--", "--host", "0.0.0.0"]
