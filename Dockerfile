# Etapa 1: build del CSS y generación de config
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY ./ ./
RUN npm run build

# Etapa 2: Nginx para servir el sitio
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/index.html ./
COPY --from=builder /app/main.js ./
COPY --from=builder /app/styles.css ./
COPY --from=builder /app/config.js ./

EXPOSE 5050
CMD ["nginx", "-g", "daemon off;"]
