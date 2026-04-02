const cmd = require('./cmd');

module.exports = {
  apply: async (path, serverSide = false) => {
    await cmd.executeCommandSimple(`kubectl apply ${serverSide ? '--server-side' : ''} -f ${path}`);
  },

  create: async (path) => {
    await cmd.executeCommandSimple(`kubectl create -f ${path}`);
  },

  setGitSecret: async (secret) => {
    await cmd.executeCommandSimple(`kubectl create secret docker-registry ghcr-secret --docker-server=ghcr.io --docker-username=ellipsis-drive --docker-password=${secret}`);
  },

  createSecret: async (name, keyValues) => {
    let secrets = await cmd.executeCommandSimple(`kubectl get secrets -o json`);

    secrets = JSON.parse(secrets);

    if (secrets.items.find((x) => x.metadata.name === name)) {
      return;
    }

    let literalParts = keyValues.map((x) => `--from-literal=${x.key}="${x.value}"`);
    literalParts = literalParts.join(' ');

    await cmd.executeCommandSimple(`kubectl create secret generic ${name} ${literalParts}`)
  },

  createPriorityClass: async (name, value) => {
    await cmd.executeCommandSimple(`kubectl create priorityclass ${name} --value=${value} --global-default=false`);
  },

  createConfigmap: async (name, dataSource) => {
    await cmd.executeCommandSimple(`kubectl create configmap ${name} ${dataSource.type === 'file' ? `--from-env-file=${dataSource.fileName}` : ''}`);
  }
}