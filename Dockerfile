FROM node:22-bookworm-slim AS base
WORKDIR /usr/local/app
COPY package.json .

RUN apt-get update && apt-get install -y curl

# Build the typescript code
FROM base AS dependencies
RUN npm install
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Create the final production-ready image
FROM base AS release
RUN useradd -m appuser && chown -R appuser /usr/local/app
ENV NODE_ENV=production
RUN npm install --only=production
COPY --from=dependencies /usr/local/app/dist ./dist
USER appuser
CMD ["node", "dist/index.js"]