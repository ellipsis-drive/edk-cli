FROM ghcr.io/puppeteer/puppeteer:24.42.0

COPY --chown=pptruser:pptruser package*.json .

RUN npm ci --only=production && npm cache clean --force

COPY --chown=pptruser:pptruser . .

CMD ["node", "run.js", "thumbnails"]