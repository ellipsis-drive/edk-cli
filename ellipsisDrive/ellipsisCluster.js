const utilities = require('./utilities');
const kubectl = require('./kubectl');
const aws = require('./aws');
const eksctl = require('./eksctl');
const cmd = require('./cmd');

module.exports = {
  create: async (config) => {
    let vpc = await createVpc(config);

    await createCluster(config, vpc)

    await setLicenseSecret(config);

    await applyPolicies(config);

    await createBuckets(config);

    await applySecrets(config);

    await applyStorage(config);

    await applyVarious(config);

    await setupEllipsisConfigmap(config);

    await setupCloudnativepg(config);

    await setupIngress(config);

    await createOwl(config);
    await createPigeon(config);
    await createEmu(config);
    await createAlbatross(config);
    await createRooster(config);
    await createPenguin(config);
  },

  createVpc: createVpc,
  createCluster: createCluster,
  setLicenseSecret: setLicenseSecret,
  applyPolicies: applyPolicies,
  applySecrets: applySecrets,
  applyStorage: applyStorage,
  applyVarious: applyVarious,
  createBuckets: createBuckets,
  createOwl: createOwl,
  createAlbatross: createAlbatross,
  setupIngress: setupIngress,
  setupCloudnativepg: setupCloudnativepg,
  setupEllipsisConfigmap: setupEllipsisConfigmap,
  createPigeon: createPigeon,
  createRooster: createRooster,
  createPenguin: createPenguin,
  createEmu: createEmu
}

async function createCluster(config, vpc) {
  let clusterTemplate = utilities.loadFile('../cluster.yaml.template');

  let keys = [
    'clusterName',
    'kubernetesVersion'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  substitutes.push({ key: 'subnetId1', value: vpc.privateSubnetId1 }, { key: 'subnetId2', value: vpc.privateSubnetId2 });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/cluster.yaml', clusterTemplate);

  eksctl.createCluster('../build/cluster.yaml', false);
}

async function createVpc(config) {
  let vpcId = await aws.createVpc();

  let publicSubnetId1 = await aws.createSubnet(vpcId, config.masterZone + 'b', '10.0.1.0/20', true);
  let privateSubnetId1 = await aws.createSubnet(vpcId, config.masterZone + 'b', '10.0.16.0/20', false);
  let publicSubnetId2 = await aws.createSubnet(vpcId, config.masterZone + 'a', '10.0.128.0/20', true);
  let privateSubnetId2 = await aws.createSubnet(vpcId, config.masterZone + 'a', '10.0.144.0/20', false);

  let internetGatewayId = await aws.createInternetGateway();

  await aws.attachInternetGateway(vpcId, internetGatewayId);

  let publicRouteTableId = await aws.createRouteTable(vpcId);

  await aws.createRoute(publicRouteTableId, { id: internetGatewayId, type: 'gateway-id'});

  await aws.associateRouteTable(publicRouteTableId, publicSubnetId1);
  await aws.associateRouteTable(publicRouteTableId, publicSubnetId2);

  let privateRouteTableId1 = await aws.createRouteTable(vpcId);
  let privateRouteTableId2 = await aws.createRouteTable(vpcId);

  let allocationId = await aws.allocateAddress();

  let NATId = await aws.createNATGateway(publicSubnetId1, allocationId);

  await aws.waitForNAT(NATId);

  await aws.createRoute(privateRouteTableId1, { id: NATId, type: 'nat-gateway-id' });
  await aws.createRoute(privateRouteTableId2, { id: NATId, type: 'nat-gateway-id' });

  await aws.associateRouteTable(privateRouteTableId1, privateSubnetId1);
  await aws.associateRouteTable(privateRouteTableId2, privateSubnetId2);

  return {
    vpcId: vpcId,
    publicSubnetId1: publicSubnetId1,
    privateSubnetId1: privateSubnetId1,
    publicSubnetId2: publicSubnetId2,
    privateSubnetId2: privateSubnetId2
  };
}

async function setLicenseSecret(config) {
  kubectl.setGitSecret(config.licenseKey);
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

async function createBuckets(config) {
  await aws.createBucket(`ellipsis-${config.companyName}-raster-uploads-${config.masterZoneAbbreviation}}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-vector-uploads-${config.masterZoneAbbreviation}}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-point-cloud-uploads-${config.masterZoneAbbreviation}}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-files-${config.masterZoneAbbreviation}}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-message-images-${config.masterZoneAbbreviation}}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-cold-vector-data-${config.masterZoneAbbreviation}}`, config.masterZone);
}

async function createOwl(config) {
  kubectl.apply('../owl/owl-pdb.yaml');
  kubectl.create('../owl/owl-queries-config-map.yaml');
  kubectl.apply('../owl/owl-service.yaml');
  kubectl.apply('../owl/owl.yaml');
}

async function createAlbatross(config) {
  kubectl.apply('../albatross/cluster-master-service-account.yaml');
  kubectl.apply('../albatross/rasterMaster/raster-master.yaml');
  kubectl.apply('../albatross/vectorMaster/vector-master.yaml');
  kubectl.apply('../albatross/pointCloud/point-cloud-master.yaml');
}

async function setupIngress(config) {
  await kubectl.apply('../ingress/ingress.yaml');
}

async function setupCloudnativepg(config) {
  await kubectl.apply('https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.28/releases/cnpg-1.28.1.yaml');
}

async function setupEllipsisConfigmap(config) {
  let clusterTemplate = utilities.loadFile('./ellipsis.env');

  let keys = [
    'apiUrl',
    'masterZone',
    'masterZoneAbbreviation',
    'frontendUrl',
    'companyName'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/ellipsis.env', clusterTemplate);

  await kubectl.createConfigmap('ellipsis', { type: file, fileName: '../build/ellipsis.env' });
}

async function createPigeon(config) {
  let certificateArn = await aws.createCertificate(config.apiUrl);

  let clusterTemplate = utilities.loadFile('../pigeon/api/api-ingress.yaml');

  let keys = [
    'apiUrl'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  substitutes.push({ key: 'apiCertificate', value: certificateArn });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/api-ingress.yaml', clusterTemplate);

  await kubectl.apply('../pigeon/api/api-pdb.yaml');
  await kubectl.apply('../pigeon/api/api-deployment.yaml');
  await kubectl.apply('../pigeon/api/api-service.yaml');
  await kubectl.apply('../build/api-ingress.yaml');

  await kubectl.apply('../pigeon/actionsWriter/actions-writer-deployment.yaml');

  await kubectl.apply('../pigeon/invalidator/invalidator.yaml');

  await kubectl.apply('../pigeon/flask/flask-pdb.yaml');
  await kubectl.apply('../pigeon/flask/flask-deployment.yaml');
  await kubectl.apply('../pigeon/flask/flask-service.yaml');

  await kubectl.apply('../pigeon/api/cache-pdb.yaml');
  await kubectl.apply('../pigeon/api/cache-queries-config-map.yaml');
  await kubectl.apply('../pigeon/cache-db/cache-db-cloudnativepg.yaml');
  await kubectl.apply('../pigeon/cache-db/cache-db-deployment.yaml');
  await kubectl.apply('../pigeon/cache-db/cache-db-service.yaml');
}

async function createRooster(config) {
  kubectl.apply('../rooster/rooster-pdb.yaml');
  kubectl.apply('../rooster/rooster-queries-config-map.yaml');
  kubectl.apply('../rooster/rooster-service.yaml');
  kubectl.apply('../rooster/rooster.yaml');

  kubectl.apply('../rooster/compressedListFeatures/file-server-api-vector-deployment.yaml');
  kubectl.apply('../rooster/compressedListFeatures/file-server-api-vector-service.yaml');
  kubectl.apply('../rooster/compressedListFeatures/file-server-api-vector-stateful-set.yaml');
}

async function createPenguin(config) {
  let certificateArn = await aws.createCertificate(config.frontendUrl);

  let clusterTemplate = utilities.loadFile('../penguin/penguin-ingress.yaml');

  let keys = [
    'frontendUrl'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  substitutes.push({ key: 'frontendCertificate', value: certificateArn });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/penguin-ingress.yaml', clusterTemplate);

  kubectl.apply('../build/penguin-ingress.yaml');
  kubectl.apply('../penguin/penguin-service.yaml');
  kubectl.apply('../penguin/penguin.yaml');
}

async function createEmu(config) {
  kubectl.apply('../emu/bucketManagement/bucket-management-deployment.yaml');
  kubectl.apply('../emu/createPointCloudBounds/create-point-cloud-bounds-deployment.yaml');
  kubectl.apply('../emu/createRasterBounds/create-raster-bounds-deployment.yaml');
  kubectl.apply('../emu/createShapeBounds/create-shape-bounds-deployment.yaml');
  kubectl.apply('../emu/emailSender/email-sender-deployment.yaml');
  kubectl.apply('../emu/fileSystemManagement/file-system-management-deployment.yaml');
  kubectl.apply('../emu/invalidationTaskAggregator/invalidation-task-aggregator-deployment.yaml');
  kubectl.apply('../emu/oauthManagement/oauth-management-deployment.yaml');
  kubectl.apply('../emu/processHardDeletes/process-hard-deletes-deployment.yaml');
  kubectl.apply('../emu/processPathRename/process-path-rename-deployment.yaml');
  kubectl.apply('../emu/searchUpdater/search-updater-deployment.yaml');
  kubectl.apply('../emu/thumbnails/thumbnails-deployment.yaml');
  kubectl.apply('../emu/userDeletionManagement/user-deletion-management-deployment.yaml');
  kubectl.apply('../emu/userHistoryAppender/user-history-appender-deployment.yaml');
}