FROM node:22.23.4-bookworm@sha256:63538dfe497cc29dfafdda25ada09b46db68a3f4cc205abf1f5d6bf0913f3384
ARG NPM_VERSION=12.2.1
ARG CODEX_VERSION=0.155.1
ARG PLAYWRIGHT_VERSION=1.63.0
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    TRON_BROWSER_CHANNEL=chromium \
    CODEX_HOME=/home/node/.codex
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
      ca-certificates curl git ripgrep python3 ffmpeg \
    && npm install -g npm@${NPM_VERSION} \
    && npm install -g @openai/codex@${CODEX_VERSION} playwright@${PLAYWRIGHT_VERSION} \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci \
    && sha256sum package.json package-lock.json > node_modules/.tron-dependency-hash \
    && mkdir -p /home/node/.codex /home/node/.npm \
    && chown -R node:node /workspace /home/node
COPY containers/codex/entrypoint.sh /usr/local/bin/tron-entrypoint
COPY containers/codex/check.mjs /usr/local/lib/tron-container-check.mjs
RUN chmod 755 /usr/local/bin/tron-entrypoint
USER node
ENTRYPOINT ["/usr/local/bin/tron-entrypoint"]
CMD ["codex", "--sandbox", "danger-full-access", "--ask-for-approval", "never", "-C", "/workspace"]
