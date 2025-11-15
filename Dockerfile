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
RUN node -e "const fs=require('fs');\nconst raw=fs.readFileSync('.env','utf8');\nconst env=raw.split(/\\r?\\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith('#')).reduce((acc,line)=>{const [key,...rest]=line.split('=');acc[key.trim()]=rest.join('=').trim();return acc;},{});\nif(!env.FOLDER_ID||!env.API_KEY){throw new Error('FOLDER_ID y API_KEY son obligatorios en .env');}\nconst config={FOLDER_ID:env.FOLDER_ID,API_KEY:env.API_KEY};\nfs.writeFileSync('config.json', JSON.stringify(config,null,2));"

# Etapa 2: imagen ligera con Nginx para servir el carrusel
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Configuración personalizada de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los artefactos build + assets
COPY --from=builder /app/index.html ./
COPY --from=builder /app/app.js ./
COPY --from=builder /app/styles.css ./
COPY --from=builder /app/config.json ./config.json

EXPOSE 5050
CMD ["nginx", "-g", "daemon off;"]
