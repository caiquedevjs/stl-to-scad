FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    OPENSCAD_PATH=/usr/local/bin/openscad-headless \
    STL_BGSD_GUI_HOST=0.0.0.0 \
    STL_BGSD_GUI_PORT=43721 \
    STL_BGSD_RENDER_TIMEOUT_MS=600000 \
    LIBGL_ALWAYS_SOFTWARE=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fontconfig \
        fonts-liberation \
        openscad \
        xauth \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node docker/openscad-headless.sh /usr/local/bin/openscad-headless
RUN chmod 0755 /usr/local/bin/openscad-headless

COPY --chown=node:node stl-to-bgsd.js stl-to-bgsd-gui.html ./
COPY --chown=node:node tools ./tools
COPY --chown=node:node lib ./lib
COPY --chown=node:node BGSD-src/schema ./BGSD-src/schema

USER node

EXPOSE 43721

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:43721/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "tools/gui-server.js"]
