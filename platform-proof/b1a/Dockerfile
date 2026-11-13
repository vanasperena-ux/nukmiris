# Future synthetic bootstrap image only. No image built/pushed by preparation.
# Node package/image digest must be pinned and independently approved before B1a.
FROM node:24.19.0-bookworm-slim
WORKDIR /proof
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
COPY src ./src
COPY b1a/runtime ./b1a/runtime
USER node
ENV B1A_MODE=INERT_UNCONFIGURED PORT=8080
ENTRYPOINT ["node", "b1a/runtime/bootstrap.mjs"]
