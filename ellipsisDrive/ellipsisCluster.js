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

    await applyStorage(config, vpc);

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
    await createClusterWorkers(config);
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
  createEmu: createEmu,
  createClusterWorkers: createClusterWorkers
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

  await eksctl.createCluster('../build/cluster.yaml', config['clusterName'], false);
}

async function createVpc(config) {
  let vpcId = await aws.createVpc();

  await aws.enabledDnsHostnames(vpcId);

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

  let securityGroupId = await aws.addNfsSecurityGroup(vpcId, config.clusterName);

  return {
    vpcId: vpcId,
    publicSubnetId1: publicSubnetId1,
    privateSubnetId1: privateSubnetId1,
    publicSubnetId2: publicSubnetId2,
    privateSubnetId2: privateSubnetId2,
    securityGroupId: securityGroupId
  };
}

async function setLicenseSecret(config) {
  await kubectl.setGitSecret(config.licenseKey);
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

async function applyStorage(config, vpc) {
  await kubectl.apply('../storage/ebs-sc.yaml');

  await kubectl.apply('../storage/efs-sc.yaml');
  await kubectl.apply('../storage/efs-finch-sc.yaml');

  await createEfsAndPersistentVolume(vpc, 'efs', config.masterZone);
  await createEfsAndPersistentVolume(vpc, 'efs-finch', config.masterZone);

  await kubectl.apply('../storage/finch-1-pvc.yaml');
  await kubectl.apply('../storage/etmpfs-pvc.yaml');

  await kubectl.apply('../storage/init-folders.yaml');
}

async function createEfsAndPersistentVolume(vpc, baseName, region) {
  let efsId = await aws.createEfs(region);
  await aws.waitForEfsAvailable(efsId);
  await aws.attachEfsToSubnet(efsId, vpc.privateSubnetId1, vpc.securityGroupId);
  await aws.attachEfsToSubnet(efsId, vpc.privateSubnetId2, vpc.securityGroupId);

  let accessPointId = await aws.createEfsAccesspoint(efsId);

  let clusterTemplate = utilities.loadFile('../storage/efs-pv.yaml');

  let substitutes = [{ key: 'storageClassName', value: baseName }, { key: 'efsId', value: efsId }, { key: 'accessPointId', value: accessPointId }];

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile(`../build/${baseName}-pv.yaml`, clusterTemplate);

  await kubectl.apply(`../build/${baseName}-pv.yaml`);
}

async function applyVarious(config) {
  await kubectl.createPriorityClass('high-priority', 1000000);
}

async function createBuckets(config) {
  await aws.createBucket(`ellipsis-${config.companyName}-raster-uploads-${config.masterZoneAbbreviation}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-vector-uploads-${config.masterZoneAbbreviation}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-point-cloud-uploads-${config.masterZoneAbbreviation}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-files-${config.masterZoneAbbreviation}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-message-images-${config.masterZoneAbbreviation}`, config.masterZone);
  await aws.createBucket(`ellipsis-${config.companyName}-cold-vector-data-${config.masterZoneAbbreviation}`, config.masterZone);
}

async function createOwl(config) {
  let clusterTemplate = utilities.loadFile('../owl/owl-data-config-map.yaml');

  let substitutes = [{ key: 'masterZone', value: config['masterZone'] }, { key: 'apiUrl', value: config['apiUrl'] }]; 

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/owl-data-config-map.yaml', clusterTemplate);

  await kubectl.apply('../owl/owl-pdb.yaml');
  await kubectl.create('../owl/owl-queries-config-map.yaml');
  await kubectl.create('../build/owl-data-config-map.yaml');
  await kubectl.create('../owl/icons-queries-config-map.yaml');
  await kubectl.apply('../owl/owl.yaml');
}

async function createAlbatross(config) {
  await kubectl.apply('../albatross/cluster-master-service-account.yaml');
  await kubectl.apply('../albatross/rasterMaster/raster-master.yaml');
  await kubectl.apply('../albatross/vectorMaster/vector-master.yaml');
  await kubectl.apply('../albatross/pointCloudMaster/point-cloud-master.yaml');
  await kubectl.apply('../albatross/exportMaster/export-master.yaml');
  await kubectl.apply('../albatross/importMaster/import-master.yaml');
}

async function setupIngress(config) {
  await kubectl.apply('../ingress/ingress-class.yaml');
}

async function setupCloudnativepg(config) {
  await kubectl.apply('https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.28/releases/cnpg-1.28.1.yaml', true);

  await kubectl.waitForCloudnativePG();
}

async function setupEllipsisConfigmap(config) {
  let clusterTemplate = utilities.loadFile('./ellipsis.env');

  let keys = [
    'apiUrl',
    'masterZone',
    'masterZoneAbbreviation',
    'frontendUrl',
    'companyName',
    'deploymentName',
    'enablePlans'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('../build/ellipsis.env', clusterTemplate);

  await kubectl.createConfigmap('ellipsis', { type: 'file', fileName: '../build/ellipsis.env' });
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

  await kubectl.apply('../pigeon/invalidator/invalidator-deployment.yaml');

  await kubectl.apply('../pigeon/flask/flask-pdb.yaml');
  await kubectl.apply('../pigeon/flask/flask-deployment.yaml');
  await kubectl.apply('../pigeon/flask/flask-service.yaml');

  await kubectl.apply('../pigeon/cache-db/cache-db-pdb.yaml');
  await kubectl.apply('../pigeon/cache-db/cache-queries-config-map.yaml');
  await kubectl.apply('../pigeon/cache-db/cache-db-cloudnativepg.yaml');
}

async function createRooster(config) {
  await kubectl.apply('../rooster/rooster-pdb.yaml');
  await kubectl.apply('../rooster/rooster-queries-config-map.yaml');
  await kubectl.apply('../rooster/rooster-service.yaml');
  await kubectl.apply('../rooster/rooster.yaml');

  await kubectl.apply('../rooster/compressedListFeatures/file-server-api-vector-service.yaml');
  await kubectl.apply('../rooster/compressedListFeatures/file-server-api-vector-stateful-set.yaml');
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

  await kubectl.apply('../build/penguin-ingress.yaml');
  await kubectl.apply('../penguin/penguin-service.yaml');
  await kubectl.apply('../penguin/penguin.yaml');
}

async function createEmu(config) {
  await kubectl.apply('../emu/bucketManagement/bucket-management-deployment.yaml');
  await kubectl.apply('../emu/createPointCloudBounds/create-point-cloud-bounds-deployment.yaml');
  await kubectl.apply('../emu/createRasterBounds/create-raster-bounds-deployment.yaml');
  await kubectl.apply('../emu/createShapeBounds/create-shape-bounds-deployment.yaml');
  await kubectl.apply('../emu/emailSender/email-sender-deployment.yaml');
  await kubectl.apply('../emu/fileSystemManagement/file-system-management-deployment.yaml');
  await kubectl.apply('../emu/invalidationTaskAggregator/invalidation-task-aggregator-deployment.yaml');
  await kubectl.apply('../emu/oauthManagement/oauth-management-deployment.yaml');
  await kubectl.apply('../emu/processHardDeletes/process-hard-deletes-deployment.yaml');
  await kubectl.apply('../emu/processPathRename/process-path-rename-deployment.yaml');
  await kubectl.apply('../emu/searchUpdater/search-updater-deployment.yaml');
  await kubectl.apply('../emu/thumbnails/thumbnails-deployment.yaml');
  await kubectl.apply('../emu/userDeletionManagement/user-deletion-management-deployment.yaml');
  await kubectl.apply('../emu/userHistoryAppender/user-history-appender-deployment.yaml');
}

async function createClusterWorkers(config) {
  await kubectl.apply('../dodo/vector-worker.yaml');
  await kubectl.apply('../hawk/raster-worker.yaml');
  await kubectl.apply('../heron/point-cloud-worker.yaml');
  await kubectl.apply('../hummingbird/export-worker.yaml');
  await kubectl.apply('../sparrow/import-worker.yaml');
}