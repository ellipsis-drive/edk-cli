FROM ghcr.io/ellipsis-drive/gdal-python

COPY --chown=ellipsis:ellipsis python/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ellipsis:ellipsis ./python ./python

ENV NODE_VERSION=20.20.0
ENV NVM_DIR=/home/ellipsis/.nvm

RUN set -ex; \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; \
    . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}; \
    . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}; \
    . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}

ENV PATH="/home/ellipsis/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

COPY --chown=ellipsis:ellipsis cluster/package*.json .

RUN npm ci --only=production && npm cache clean --force

COPY --chown=ellipsis:ellipsis ./cluster ./cluster

ENTRYPOINT ["node", "cluster/src/pointCloudCluster/pointCloudCluster.js", "worker"]