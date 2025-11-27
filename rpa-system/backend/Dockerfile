FROM node:18-alpine
WORKDIR /usr/src/app

# Install build tools for native modules (e.g., bcrypt) on Alpine (musl)
RUN apk add --no-cache python3 make g++ libc6-compat
ENV PYTHON=python3

COPY package*.json ./
# Prefer npm ci when lockfile exists, fall back to npm install
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
EXPOSE 3030
CMD ["node", "server.js"]
