# Etapa 1: build del CSS con Tailwind
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código necesario para compilar estilos
COPY ./ ./
RUN npm run build:css
COPY .env ./.env
RUN node scripts/generate-config.js

# Etapa 2: imagen ligera con Nginx para servir el carrusel
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Configuración personalizada de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los artefactos build + assets
COPY --from=builder /app/index.html ./
COPY --from=builder /app/main.js ./
COPY --from=builder /app/styles.css ./
COPY --from=builder /app/config.json ./config.json
COPY --from=builder /app/config.js ./config.js

EXPOSE 5050
CMD ["nginx", "-g", "daemon off;"]
