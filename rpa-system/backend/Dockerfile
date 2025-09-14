FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
# Install all dependencies (dev deps included) so local dev container has required packages
RUN npm ci --silent
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
