const utilities = require('./utilities');
const kubectl = require('./kubectl');
const aws = require('./aws');
const eksctl = require('./eksctl');
const cmd = require('./cmd');

module.exports = {
  create: async (config) => {
    let clusterTemplate = utilities.loadFile('../cluster.yaml.template');

    let keys = [
      'clusterName',
      'kubernetesVersion'
    ];
    
    let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

    clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

    utilities.saveFile('../build/cluster.yaml', clusterTemplate);

    eksctl.createCluster('../build/cluster.yaml', true);

    kubectl.setGitSecret(config.licenseKey);

    await applyPolicies(config);

    await applySecrets(config);

    await applyStorage(config);

    await applyVarious(config);
  }
}

async function applyPolicies(config) {
  let policyInfo = await aws.createPolicy('EKS-S3-Access', '../s3-access-policy.json');
    
  let arn = policyInfo.Policy.Arn;

  await eksctl.createServiceAccount('s3-access-sa', config.clusterName, arn);
}

async function applySecrets(config) {
  await kubectl.createSecret('secret', [
    { key: 'secret', value: config.loginSecret }
  ]);

  await kubectl.createSecret('oauth-secret', [
    { key: 'secret', value: config.oauthSecret }
  ]);

  await kubectl.createSecret('owl-db-password', [
    { key: 'username', value: 'ellipsis_app' },
    { key: 'password', value: config.mainDbPassword }
  ]);

  await kubectl.createSecret('rooster-db-password', [
    { key: 'username', value: 'ellipsis_app' },
    { key: 'password', value: config.vectorDbPassword }
  ]);

  await kubectl.createSecret('pigeon-db-password', [
    { key: 'username', value: 'local_api' },
    { key: 'password', value: config.cacheDbPassword }
  ]);

  await kubectl.createSecret('ellipsis-internal-key', [
    { key: 'get-cache', value: config.internalCallKey },
    { key: 'point-cloud', value: config.internalCallKey },
    { key: 'process', value: config.internalCallKey },
    { key: 'raster', value: config.internalCallKey },
    { key: 'redirect', value: config.internalCallKey },
    { key: 'sanity-vector', value: config.internalCallKey },
    { key: 'vector', value: config.internalCallKey }
  ]);

  await kubectl.createSecret('internal-mail', [
    { key: 'username', value: config.internalMailUsername },
    { key: 'password', value: config.internalMailPassword }
  ]);

  await kubectl.createSecret('noreply-mail', [
    { key: 'username', value: config.noReplyMailUsername },
    { key: 'password', value: config.noReplyMailPassword }
  ]);

  await kubectl.createSecret('google-client', [
    { key: 'id', value: config.googleClientId },
    { key: 'secret', value: config.googleClientSecret }
  ]);
}

async function applyStorage(config) {
  await kubectl.apply('../storage/storage/ebs-sc.yaml');
  await kubectl.apply('../storage/storage/efs-sc.yaml');
  await kubectl.apply('../storage/storage/efs-finch-sc.yaml');

  await kubectl.apply('../storage/storage/efs-pv.yaml');

  await kubectl.apply('../storage/storage/finch-1-pvc.yaml');
  await kubectl.apply('../storage/storage/etmpfs-pvc.yaml');
}

async function applyVarious(config) {
  await kubectl.createPriorityClass('high-priority', 1000000);
}

async function createOwl(config) {
  kubectl.apply('../owl/owl-configmap.yaml');
  kubectl.apply('../owl/owl-queries-config-map.yaml');
  kubectl.apply('../owl/owl-service.yaml');
  kubectl.apply('../owl/owl.yaml');
}

async function createAlbatross(config) {
  kubectl.apply('../albatross/cluster-master-service-account.yaml');
  kubectl.apply('../albatross/rasterMaster/raster-master.yaml');
  kubectl.apply('../albatross/vectorMaster/vector-master.yaml');
  kubectl.apply('../albatross/pointCloud/point-cloud-master.yaml');
}