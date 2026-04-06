# --- STAGE 1: BUILD REACT ---
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# --- STAGE 2: PRODUCTION SERVER (NGINX) ---
FROM nginx:stable-alpine

# Copiar build de React a Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Opcional: reemplazar el nginx.conf para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
