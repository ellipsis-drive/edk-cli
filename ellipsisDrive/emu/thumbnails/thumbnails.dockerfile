FROM ghcr.io/puppeteer/puppeteer:latest

COPY --chown=pptruser:pptruser package*.json .

RUN npm ci --only=production && npm cache clean --force

COPY --chown=pptruser:pptruser . .

CMD ["node", "run.js", "thumbnails"]