FROM node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
COPY --chown=node:node . /proof
WORKDIR /proof
USER node
ENV B1A2_MODE=INERT_UNCONFIGURED B1A2_ROLE=gateway PORT=8080
ENTRYPOINT ["node", "b1a2/runtime/entrypoint.mjs"]
