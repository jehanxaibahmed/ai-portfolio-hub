FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build --base=/hub/

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/hub
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
