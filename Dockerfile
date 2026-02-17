# Stage 1: Build (Node 22.12+ required by Angular 20)
FROM node:22.12-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including dev for build)
RUN npm ci --include=dev

# Copy source
COPY . .

# Build Angular app
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist/CoSchemaLab_front/browser /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
