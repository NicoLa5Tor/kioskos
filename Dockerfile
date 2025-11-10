# Etapa 1: build del CSS con Tailwind
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY page/package*.json ./
RUN npm install

# Copiar el resto del código necesario para compilar estilos
COPY page/ ./
RUN npm run build:css

# Etapa 2: imagen ligera con Nginx para servir el carrusel
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Configuración personalizada de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los artefactos build + assets
COPY --from=builder /app/index.html ./
COPY --from=builder /app/app.js ./
COPY --from=builder /app/styles.css ./
COPY .env ./.env
COPY .env.example ./.env.example

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
