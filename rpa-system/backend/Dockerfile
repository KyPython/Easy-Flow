FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
# Install all dependencies (dev deps included) so local dev container has required packages
# Use npm install to be robust when package-lock.json is missing in some dev clones
RUN npm install --silent
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
