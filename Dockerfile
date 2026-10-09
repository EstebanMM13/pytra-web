# Build stage: compile the Angular app.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: serve static files with nginx, listening on $PORT.
FROM nginx:1.27-alpine
ENV PORT=8080
# The official image runs envsubst on /etc/nginx/templates/*.template at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/pytra-web/browser /usr/share/nginx/html
EXPOSE 8080
