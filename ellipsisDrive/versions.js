const kubectl = require('./kubectl');

const VERSIONS = [
    {
        version: '1.0.0',
        images: {
            'export-master': '1.0.0',
            'import-master': '1.0.0',
            'point-cloud-master': '1.0.0',
            'raster-master': '1.0.0',
            'vector-master': '1.0.0',
            'export-worker': '1.0.0',
            'import-worker': '1.0.0',
            'point-cloud-worker': '1.0.0',
            'raster-worker': '1.0.0',
            'vector-worker': '1.0.0',
            'bucket-management': '1.0.0',
            'create-point-cloud-bounds': '1.0.0',
            'create-raster-bounds': '1.0.0',
            'create-shape-bounds': '1.0.0',
            'email-sender': '1.0.0',
            'file-system-management': '1.0.0',
            'invalidation-task-aggregator': '1.0.0',
            'oauth-management': '1.0.0',
            'process-hard-deletes': '1.0.0',
            'process-path-rename': '1.0.0',
            'search-updater': '1.0.0',
            'thumbnails': '1.0.0',
            'user-deletion-management': '1.0.0',
            'user-history-appender': '1.0.0',
            'penguin': '1.0.0',
            'actions-writer': '1.0.0',
            'api': '1.0.0',
            'flask': '1.0.0',
            'invalidator': '1.0.0',
            'tile-service-cache': '1.0.0',
            'file-server-api-vector': '1.0.0'
        }
    },
    {
        version: '1.0.1',
        images: {
            'api': '1.0.1'
        },
        upgrade: async function() {
            console.log('upgrading to version 1.0.1');

            for (const [key, value] of Object.entries(this.images)) {
                await kubectl.setImage(`deployment/${key} ${key}=${key}:${value}`);
                await kubectl.rolloutRestart(`deployment ${key}`);
            }
        }
    },
    {
        version: '1.1.0',
        images: {
            'api': '1.0.2'
        },
        queries: { 
            owl: [
                'SELECT 1 FROM users;'
            ]
        },
        upgrade: async function() {
            console.log('upgrading to version 1.0.2');

            for (const [key, value] of Object.entries(this.images)) {
                await kubectl.setImage(`deployment/${key} ${key}=${key}:${value}`);
                await kubectl.rolloutRestart(`deployment ${key}`);
            }

            for (const [key, value] of Object.entries(this.queries)) {
                await kubectl.execQuery(key, value.join('\n'));
            }
        }
    },
    {
        version: '1.2.0',
        images: {
            'api': '1.2.0',
            'penguin': '1.1.0'
        },
        upgrade: async function () {
            console.log('upgrading to version 1.2.0');

            for (const [key, value] of Object.entries(this.images)) {
                await kubectl.setImage(`deployment/${key} ${key}=${key}:${value}`);
                await kubectl.rolloutRestart(`deployment ${key}`);
            }
        }
    },
    {
        version: '1.2.1',
        queries: {
            owl: [
                "ALTER TABLE map_timestamps ALTER COLUMN version TYPE INT;",
                "ALTER TABLE map_timestamps ADD COLUMN viewable BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE raster_uploads ADD COLUMN map_timestamp_version INT DEFAULT 0;",
                "UPDATE map_timestamps SET viewable = TRUE WHERE status = 'active';"
            ]
        },
        upgrade: async function () {
            await standardUpdate(this);
        }
    },
    {
        version: '1.2.2',
        images: {
            'penguin': '1.2.0'
        },
        upgrade: async function () {
            await standardUpdate(this);
        }
    }
];

async function standardUpdate(version) {
    console.log(`upgrading to version ${version.version}`);

    if (version.images) {
        for (const [key, value] of Object.entries(version.images)) {
            await kubectl.setImage(`deployment/${key} ${key}=${key}:${value}`);
            await kubectl.rolloutRestart(`deployment ${key}`);
        }
    }

    if (version.queries) {
        for (const [key, value] of Object.entries(version.queries)) {
            await kubectl.execQuery(key, value.join('\n'));
        }
    }
}

module.exports = {
    versions: VERSIONS
}