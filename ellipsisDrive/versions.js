// THIS FILE GETS PULLED BY OLD RELEASES BE VERY CAREFUL ABOUT DEPENDENCIES
const cmd = require('./cmd');

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
            await standardUpdate(this);
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
            await standardUpdate(this);
        }
    },
    {
        version: '1.2.0',
        images: {
            'api': '1.2.0',
            'penguin': '1.1.0'
        },
        upgrade: async function () {
            await standardUpdate(this);
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
    },
    {
        version: '1.3.0',
        images: {
            'raster-master': '1.1.0',
            'vector-master': '1.1.0',
            'point-cloud-master': '1.1.0',
            'export-master': '1.1.0',
            'import-master': '1.1.0'
        },
        upgrade: async function () {
            await editResource({kind: "ConfigMap", target: "ellipsis", edits: [
                { action: "set", target: "MIN_RASTER_WORKERS", value: "0"},
                { action: "set", target: "MIN_VECTOR_WORKERS", value: "0" },
                { action: "set", target: "MIN_POINT_CLOUD_WORKERS", value: "0" },
                { action: "set", target: "MIN_EXPORT_WORKERS", value: "0" },
                { action: "set", target: "MIN_IMPORT_WORKERS", value: "0" },
                { action: "set", target: "MAX_RASTER_WORKERS", value: "2" },
                { action: "set", target: "MAX_VECTOR_WORKERS", value: "2" },
                { action: "set", target: "MAX_POINT_CLOUD_WORKERS", value: "2" },
                { action: "set", target: "MAX_EXPORT_WORKERS", value: "2" },
                { action: "set", target: "MAX_IMPORT_WORKERS", value: "2" }
            ]});
            await standardUpdate(this);
        }
    }
];

async function standardUpdate(version) {
    console.log(`upgrading to version ${version.version}`);

    if (version.images) {
        for (const [key, value] of Object.entries(version.images)) {
            await setImage(`deployment/${key} ${key}=ghcr.io/ellipsis-drive/${key}:${value}`);
            await rolloutRestart(`deployment ${key}`);
        }
    }

    if (version.queries) {
        for (const [key, value] of Object.entries(version.queries)) {
            await execQuery(key, value.join('\n'));
        }
    }
}

async function setImage(imageChange) {
    await cmd.executeCommandSimple(`kubectl set image ${imageChange}`);
}

async function rolloutRestart(restart) {
    await cmd.executeCommandSimple(`kubectl rollout restart ${restart}`);
}

async function execQuery(database, query) {
    let secret = database === 'owl' ? 'owl-db-password' : 'pigeon-db-password';
    await cmd.executeCommandSimple(`kubectl exec -i ${database}-1 -- env PGPASSWORD=$(kubectl get secret ${secret} -o jsonpath='{.data.password}' | base64 --decode) psql -h ${database}-rw -U ellipsis_app -d ellipsis -f -`, false, null, query);
}

async function editResource(opts) {
    try {
        await cmd.executeCommandSimple(`kubectl get pods`);
    }
    catch {
        throw new Error('No kubernetes cluster exists, aborting editting');
    }

    let target = opts.target;
    let kind = opts.kind;
    let edits = isValid(opts.edits, 'jsonString') ? JSON.parse(opts.edits) : opts.edits;

    if (!utilities.isValid(target, 'string')) {
        throw new Error (`target must be a valid string`);
    }

    if (!utilities.isValid(kind, 'string')) {
        throw new Error (`kind must be a valid string`);
    }

    if (!utilities.isValid(edits, 'array')) {
        throw new Error (`edits must be a valid json array`);
    }

    console.log(`target ${target} of kind ${kind}`);

    if (kind !== 'ConfigMap' && kind !== 'secret') {
        throw new Error (`Can only edit targets of kind ConfigMap and secret`);
    }

    let isSecret = kind === 'secret';

    let targetResource;
    if (isSecret) {
        targetResource = await kubectl.getSecret(target);
    }
    else {
        targetResource = await kubectl.getConfigMap(target);
    }

    if (!targetResource) {
        throw new Error (`invalid target resource to edit: ${targetResource}`);
    }

    if (!targetResource.data) {
        targetResource.data = {};
    }

    for (let i = 0; i < edits.length; i++) {
        if (!utilities.isValid(edits[i], 'object')) {
        throw new Error (`edits[i] must be a valid json`);
        }

        let editAction = edits[i].action;
        let targetKey = edits[i].target;
        let value = edits[i].value;

        if (!utilities.isValid(editAction, 'string')) {
        throw new Error (`edits[i].action must be a valid string`);
        }

        if (!utilities.isValid(targetKey, 'string')) {
        throw new Error (`edits[i].target must be a valid string`);
        }

        switch (editAction) {
        case 'set': {
            console.log(`${editAction} to ${target}`);

            if (!utilities.isValid(value, 'string')) {
            throw new Error (`edits[i].value must be a valid string`);
            }

            targetResource.data[targetKey] = isSecret ? stringToBase64(value) : value;
            break;
        }
        case 'delete': {
            console.log(`${editAction} to ${target}`);

            if (!targetResource.data[targetKey]) {
            throw new Error (`edits[i].target doesn't exists which conflicts with action ${editAction}`);
            }

            delete targetResource.data[targetKey];
            break;
        }
        default:
            throw new Error (`invalid edit action: ${editAction}`);
            break;
        }
    }

    await cmd.executeCommandSimple(`kubectl apply -f -`, false, null, JSON.stringify(edit));
}

module.exports = {
    versions: VERSIONS
}