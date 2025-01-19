# Dockerfile
FROM node:18.20.4-alpine3.19

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy rest of the application
COPY . .

EXPOSE 8888

CMD ["node", "server.js"]