FROM node:20-alpine

WORKDIR /app

# Install project deps (includes all platform deps listed in package.json)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy project source + std-platform submodule (deploy-lib excluded via .dockerignore)
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
