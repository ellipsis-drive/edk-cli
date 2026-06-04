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
            'process-hard-deleted': '1.0.0',
            'process-path-rename': '1.0.0',
            'search-updater': '1.0.0',
            'thumbnails': '1.0.0',
            'user-deletion-management': '1.0.0',
            'user-history-appender': '1.0.0',
            'penguin': '1.0.0',
            'actions-writer': '1.0.0',
            'api': '1.0.0',
            'flask': '1.0.0',
            'invaldiator': '1.0.0',
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
        queries: {
            owl: [
                "INSERT INTO ui_theme (type, value, environment) VALUES('favicon', 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAABgmlDQ1BzUkdCIElFQzYxOTY2LTIuMQAAKJF1kb9LQlEUxz9qYT8MgxoaHCSsqaIspJYGoyyoBjXo16LPpwZqj/eMiNagVSiIWvo11F9Qa9AcBEURRHM0FrVUvM5LQYk8l3PP537vPYd7zwV7NKNkjZpeyObyejgU9M7OzXudL9TioYkB6mOKoU1FxqJUtY87bFa86bZqVT/3rzUmVEMBW53wsKLpeeFx4cnVvGbxtnCrko4lhE+Fu3S5oPCtpceL/GxxqshfFuvR8AjYm4W9qQqOV7CS1rPC8nJ82cyKUrqP9RKXmpuJSGwX92AQJkQQLxOMMkKAPoZkDtCNnx5ZUSW/9zd/mmXJVWTWWENniRRp8nSJuiLVVYlJ0VUZGdas/v/tq5Hs9xeru4JQ+2Sabx3g3ILvgml+Hprm9xE4HuEiV85fPoDBd9ELZc23D+4NOLssa/EdON+Etgctpsd+JYe4PZmE1xNomoOWa2hYKPastM/xPUTX5auuYHcPOuW8e/EHiK5n9fzWIEAAAAAJUExURf8AAAAAAMlFJgtRdvkAAAADdFJOU///ANfKDUEAAAAJcEhZcwAALiMAAC4jAXilP3YAAAApSURBVBiVY1gFBQxEMRYwAIEWkLECxOACSy2AqSGKoYWTsYKODKK9DAAvZJud3ifhhgAAAABJRU5ErkJggg==', 'default');"
            ]
        },
        upgrade: async function () {
            console.log('upgrading to version 1.2.0');

            for (const [key, value] of Object.entries(this.images)) {
                await kubectl.setImage(`deployment/${key} ${key}=${key}:${value}`);
                await kubectl.rolloutRestart(`deployment ${key}`);
            }

            for (const [key, value] of Object.entries(this.queries)) {
                await kubectl.execQuery(key, value.join('\n'));
            }
        }
    }
];

module.exports = {
    versions: VERSIONS
}