const fs = require('fs');

const isValid = require('./utilities').isValid;
const utilities = require('./utilities');
const kubectl = require('./kubectl');
const aws = require('./aws');
const eksctl = require('./eksctl');
const versionManagement = require('./versionManagement');
const { parse: jsoncParse, modify, applyEdits } = require('jsonc-parser');

module.exports = {
  create: async (config) => {
    let configOk = validateConfig(config);

    if (!configOk) {
      return;
    }

    fs.closeSync(fs.openSync(utilities.historyPath, 'w'));

    let vpc;
    if (config['vpc']) {
      vpc = config['vpc'];
    }
    else {
      vpc = await createVpc(config);
    }

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

    await kubectl.setEllipsisDriveConfig(config);

    let history = utilities.loadFile(utilities.historyPath);
    await kubectl.setHistory(history);
  },

  configure: async () => {
    const length = 64;
    const keys = [
      'loginSecret',
      'oauthSecret',
      'mainDbPassword',
      'vectorDbPassword',
      'cacheDbPassword',
      'internalCallKey'
    ];

    let configText = utilities.loadFile('./config.jsonc');

    let edits = [];
    
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];

      edits.push(...modify(configText, [key], utilities.generatePassword(length), {}));
    }
    
    configText = applyEdits(configText, edits);
    
    utilities.saveFile('./config.jsonc', configText);
  },

  validateConfig: validateConfig,
  deleteCluster: deleteCluster,

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
  createClusterWorkers: createClusterWorkers,

  upgrade: async (newEllipsisDriveVersion) => { 
    let currentConfig = await kubectl.getEllipsisDriveConfig();
    let oldEllipsisDriveVersion = currentConfig['ellipsisDriveVersion'];
    await versionManagement.upgrade(oldEllipsisDriveVersion, newEllipsisDriveVersion);
    let newConfig = { ...currentConfig, ellipsisDriveVersion: newEllipsisDriveVersion };
    await kubectl.setEllipsisDriveConfig(newConfig);
  },
  pull: async () => {
    await versionManagement.pull();
  },

  edit: async (opts) => {
    try {
      await kubectl.exec(`get pods`);
    }
    catch {
      throw('No kubernetes cluster exists, aborting editting');
    }

    let target = opts.target;
    let kind = opts.kind;
    let edits = isValid(opts.edits, 'jsonString') ? JSON.parse(opts.edits) : opts.edits;

    if (!utilities.isValid(target, 'string')) {
      throw (`target must be a valid string`);
    }

    if (!utilities.isValid(kind, 'string')) {
      throw (`kind must be a valid string`);
    }

    if (!utilities.isValid(edits, 'array')) {
      throw (`edits must be a valid json array`);
    }

    console.log(`target ${target} of kind ${kind}`);

    if (kind !== 'ConfigMap' && kind !== 'secret') {
      throw (`Can only edit targets of kind ConfigMap and secret`);
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
      throw (`invalid target resource to edit: ${targetResource}`);
    }

    if (!targetResource.data) {
      targetResource.data = {};
    }

    for (let i = 0; i < edits.length; i++) {
      if (!utilities.isValid(edits[i], 'object')) {
        throw (`edits[i] must be a valid json`);
      }

      let editAction = edits[i].action;
      let targetKey = edits[i].target;
      let value = edits[i].value;

      if (!utilities.isValid(editAction, 'string')) {
        throw (`edits[i].action must be a valid string`);
      }

      if (!utilities.isValid(targetKey, 'string')) {
        throw (`edits[i].target must be a valid string`);
      }

      switch (editAction) {
        case 'add': {
          console.log(`${editAction} to ${target}`);

          if (!utilities.isValid(value, 'string')) {
            throw (`edits[i].value must be a valid string`);
          }

          if (targetResource.data[targetKey]) {
            throw (`edits[i].target already exists which conflicts with action ${editAction}`);
          }

          targetResource.data[targetKey] = isSecret ? stringToBase64(value) : value;
          break;
        }
        case 'edit': {
          console.log(`${editAction} to ${target}`);

          if (!utilities.isValid(value, 'string')) {
            throw (`edits[i].value must be a valid string`);
          }

          if (!targetResource.data[targetKey]) {
            throw (`edits[i].target doesn't exists which conflicts with action ${editAction}`);
          }

          targetResource.data[targetKey] = isSecret ? stringToBase64(value) : value;
          break;
        }
        case 'delete': {
          console.log(`${editAction} to ${target}`);

          if (!targetResource.data[targetKey]) {
            throw (`edits[i].target doesn't exists which conflicts with action ${editAction}`);
          }

          delete targetResource.data[targetKey];
          break;
        }
        default:
          throw (`invalid edit action: ${editAction}`);
          break;
      }
    }

    await kubectl.editResource(targetResource);

    let dependents = await findDependentResources(targetResource);

    for (let i = 0; i < dependents.length; i++) {
      await kubectl.rolloutRestart(`${dependents[i].kind} ${dependents[i].name}`)
    }
  },

  scale: async (opts) => {
    try {
      await kubectl.exec(`get pods`);
    }
    catch {
      throw ('No kubernetes cluster exists, aborting editting');
      return;
    }

    let action = opts.action;
    let target = opts.target;
    let kind = opts.kind;
    let editOpts = isValid(utilities.opts.editOpts, 'jsonString') ? JSON.parse(utilities.opts.editOpts) : utilities.opts.editOpts;

    if (!utilities.isValid(action, 'string')) {
      throw (`action must be a valid string`);
      return;
    }

    if (!utilities.isValid(target, 'string')) {
      throw (`target must be a valid string`);
      return;
    }

    if (!utilities.isValid(kind, 'string')) {
      throw (`kind must be a valid string`);
      return;
    }

    if (editOpts !== null && editOpts !== undefined && !utilities.isValid(editOpts, 'object')) {
      throw (`editOpts must be a valid json object if defined`);
      return;
    }

    switch (action) {
      case 'scale': {
        console.log(`${action} the ${target} of kind ${kind}`);

        if (kind !== 'deployment' && kind !== 'statefulset') {
          throw (`can only ${action} targets of kind deployment and statefulset`);
          return;
        }

        let resourcesList = await kubectl.exec(`get ${kind} ${target} - o json`);
        resourcesList = JSON.parse(resourcesList);

        if (!resourcesList.items || resourcesList.items.length === 0) {
          throw (`target with name ${target} if kind ${kind} could not be found`);
          return;
        }

        let quantity = utilities.intStringtoInt(editOpts.quantity);

        if (!editOpts || !utilities.isValid(quantity, 'int')) {
          throw (`editOpts.quantity must be a valid int for action ${action}`);
          return;
        }

        await kubectl.scale(target, quantity);
        break;
      }
      case 'edit': {
        console.log(`${action} the ${target} of kind ${kind}`);

        if (kind !== 'configMap' && kind !== 'secret') {
          throw (`can only ${action} targets of kind configMap and secret`);
          return;
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
          throw (`invalid target resource to edit: ${targetResource}`);
          break;
        }

        if (!editOpts || !utilities.isValid(editOpts.edits, 'array')) {
          throw (`editOpts.edits must be a valid array`);
          break;
        }

        for (let i = 0; i < editOpts.edits.length; i++) {
          if (!utilities.isValid(editOpts.edits[i], 'object')) {
            throw (`editOpts.edits[i] must be a valid json`);
            break;
          }

          let editAction = editOpts.edits[i].action;
          let targetKey = editOpts.edits[i].target;
          let value = editOpts.edits[i].value;

          if (!utilities.isValid(editAction, 'string')) {
            throw (`editOpts.edits[i].action must be a valid string`);
            break;
          }

          if (!utilities.isValid(targetKey, 'string')) {
            throw (`editOpts.edits[i].target must be a valid string`);
            break;
          }

          switch (editAction) {
            case 'add': {
              console.log(`${editAction} to ${target}`);

              if (!utilities.isValid(value, 'string')) {
                throw (`editOpts.edits[i].value must be a valid string`);
                break;
              }

              if (targetResource.data[targetKey]) {
                throw (`editOpts.edits[i].target already exists which conflicts with action ${editAction}`);
                break;
              }

              targetResource.data[targetKey] = isSecret ? stringToBase64(value) : value;
              break;
            }
            case 'edit': {
              console.log(`${editAction} to ${target}`);

              if (!utilities.isValid(value, 'string')) {
                throw (`editOpts.edits[i].value must be a valid string`);
                break;
              }

              if (!targetResource.data[targetKey]) {
                throw (`editOpts.edits[i].target doesn't exists which conflicts with action ${editAction}`);
                break;
              }

              targetResource.data[targetKey] = isSecret ? stringToBase64(value) : value;
              break;
            }
            case 'delete': {
              console.log(`${editAction} to ${target}`);

              if (!targetResource.data[targetKey]) {
                throw (`editOpts.edits[i].target doesn't exists which conflicts with action ${editAction}`);
                break;
              }

              delete targetResource.data[targetKey];
              break;
            }
            default:
              throw (`invalid edit action: ${editAction}`);
              break;
          }
        }

        await kubectl.editResource(targetResource);

        let dependents = await findDependentResources(targetResource);

        for (let i = 0; i < dependents.length; i++) {
          await kubectl.rolloutRestart(`${dependents[i].kind} ${dependents[i].name}`)
        }

        break;
      }
      default:
        throw (`invalid action to edit: ${action}`);
        break;
    }
  },
}

async function findDependentResources(target) {
  let targetName = target.name;
  let targetKind = target.kind;
  
  let resourcesList = await kubectl.exec('get deployment,statefulset,daemonset -o json');
  resourcesList = JSON.parse(resourcesList);

  let dependents = [];

  if (!resourcesList.items || resourcesList.items.length === 0) {
    return dependents;
  }

  resourcesList.items.forEach((resource) => {
    let kind = resource.kind.toLowerCase();
    let name = resource.metadata.name;
    let podTemplate = resource.spec?.template?.spec;

    if (!podTemplate) {
      console.log('no pod template found');
      return;
    }

    let usesTarget = false;

    console.log('volume check')
    if (podTemplate.volumes) {
      if (targetKind === 'ConfigMap') {
        usesTarget = podTemplate.volumes.filter((x) => x.configMap && x.configMap.name === targetName) > 0;
      }
      else {
        usesTarget = podTemplate.volumes.filter((x) => x.secret && x.secretName === targetName) > 0;
      }
    }

    console.log('env check')
    if (!usesTarget && podTemplate.containers) {
      console.log(x.envFrom);
      usesTarget = podTemplate.containers.filter((x) => {
        (x.envFrom && x.envFrom.find((y) => (targetKind === 'ConfigMap') ? (y.configMapRef && y.configMapRef.name === targetName) : (y.secretRef && y.secretRef.name === targetName))) || 
          (x.env && x.env.find((y) => (targetKind === 'ConfigMap') ? (y.valueFrom && y.valueFrom.configMapKeyRef && y.valueFrom.configMapKeyRef.name === targetName) : (y.valueFrom && y.valueFrom.secretKeyRef && y.valueFrom.secretKeyRef.name === targetName)));
      }) > 0;
    }

    if (usesTarget) {
      dependents.push({ kind: kind, name: name });
    }
  });

  console.log(`Found ${dependents.length} dependent resources:`, dependents);
  return dependents;
}

function stringToBase64(string) {
  return Buffer.from(string).toString('base64');
}

function validateConfig(config) {
  const optionalKeys = [
    'googleClientId',
    'googleClientSecret',
    'vpc'
  ];

  const limitedStringKeys = [
    'clusterName',
    'companyName',
    'deploymentName',
    'masterZoneAbbreviation'
  ];

  let templateConfig = utilities.loadFile('./ellipsisDrive/config-template.jsonc');
  templateConfig = jsoncParse(templateConfig);

  let keys = Object.keys(templateConfig);

  let errors = false;

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];

    let value = config[key];

    if ((!value || value === "") && !optionalKeys.includes(key)) {
      errors = true;
      console.log(`Missing or empty value for '${key}'`);
    }

    let isString = typeof value === 'string' || value instanceof String;

    if (!isString && key !== 'vpc') {
      errors = true;
      console.log(`'${key}' must be of type string`);
    }

    if (limitedStringKeys.includes(key)) {
      let isOk = /^[a-z0-9-]+$/.test(value);

      if (!isOk) {
        errors = true;
        console.log(`'${key}' may only contain a-z, 0-9 and hyphens`);
      }
    }

    if (key === 'vpc' && (value !== null && value !== undefined)) {
      let validVpc = !Array.isArray(value) && typeof value === 'object';

      if (!validVpc) {
        errors = true;
        console.log(`'${key}' must be of type object`);
      }
      else {
        const vpcKeys = [
          'vpcId',
          'publicSubnetId1',
          'privateSubnetId1',
          'publicSubnetId2',
          'privateSubnetId2',
          'subnet1AvailabilityZone',
          'subnet2AvailabilityZone',
          'securityGroupId'
        ];

        for (let i = 0; i < vpcKeys.length; i++) {
          let isString = typeof value[vpcKeys[i]] === 'string' || value[vpcKeys[i]] instanceof String;

          if (!isString) {
            errors = true;
            console.log(`'vpc.${vpcKeys[i]}' must be of type string`);
          }
        }
      }
    }
  }

  if (errors) {
    console.log(`Errors found with the current config. Please fix these issues before proceeding`);
    return false;
  }
  else {
    console.log('Config is OK');
    return true;
  }
}

async function deleteCluster(config) {
  await kubectl.deleteVolumes();

  let history;
  try {
    history = await kubectl.getHistory();
    utilities.saveFile(utilities.historyPath, history);
    history = history.split('\n').filter((x) => x).reverse();
  }
  catch (e) {
    console.log('Could not load history from the kubernetes cluster');

    try {
      history = utilities.loadFile(utilities.historyPath);
      history = history.split('\n').filter((x) => x).reverse();
    }
    catch (e) {
      console.error(e);

      if (e.message.includes('ENOENT')) {
        console.log('Could not load history, assuming there is nothing to delete');

        history = [];
      }
      else {
        throw ('Could not load the history file');
      }
    }
  }

  console.log(JSON.stringify(history));

  while (true) {
    let nextHistory = [];

    for (let i = 0; i < history.length; i++) {
      let createEvent = JSON.parse(history[i]);

      console.log('entry', createEvent);

      let type = createEvent.type;
      let id = createEvent.id;

      try {
        switch (type) {
          case 'efs': {
            await aws.deleteEfs(id, config.masterZone);
            break;
          }
          case 'bucket': {
            await aws.deleteBucket(id, config.masterZone);
            break;
          }
          case 'attachMountTarget': {
            await aws.deattachEfsToSubnet(id, config.masterZone);
            break;
          }
          case 'certificate': {
            await aws.deleteCertificate(id);
            break;
          }
          // case 'cloudformationStack': {
          //   await aws.deleteCloudformationStack(id);
          //   break;
          // }
          case 'ip': {
            await aws.releaseAddress(id);
            break;
          }
          case 'NAT': {
            await aws.deleteNATGateway(id);
            break;
          }
          case 'vpc': {
            await aws.deleteVpc(id);
            break;
          }
          case 'routeTable': {
            await aws.deleteRouteTable(id);
            break;
          }
          case 'securityGroup': {
            await aws.deleteSecurityGroup(id);
            break;
          }
          case 'internetGateway': {
            await aws.deleteInternetGateway(id);
            break;
          }
          case 'attachInternetGateway': {
            await aws.deattachInternetGateway(id, createEvent.vpcId);
            break;
          }
          case 'subnet': {
            await aws.deleteSubnet(id);
            break;
          }
          case 'eks': {
            await eksctl.deleteCluster(config.clusterName, config.masterZone);
            break;
          }
          default:
            throw('invalid type in the history of delete cluster', type);
            break;
        }
      }
      catch (e) {
        if (e.message.includes('does not exist') || e.message.includes('https response error StatusCode: 404') || e.message.includes('Could not find') || e.message.includes('not found')) {
          console.log('Already deleted, skipping this one');
        }
        else {
          nextHistory.push(history[i]);
        }
      }
    }

    if (nextHistory.length === 0) {
      break;
    }
    else {
      history = nextHistory;
      await new Promise((x) => setTimeout(x, 500));
    }
  }

  console.log('finished deleting the resources');
}

async function createCluster(config, vpc) {
  let clusterTemplate = utilities.loadFile('./ellipsisDrive/cluster.yaml.template');

  let keys = [
    'clusterName',
    'masterZone',
    'kubernetesVersion'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  substitutes.push(
    { key: 'subnetId1', value: vpc.privateSubnetId1 }, 
    { key: 'subnetId2', value: vpc.privateSubnetId2 },
    { key: 'subnet1AvailabilityZone', value: vpc.subnet1AvailabilityZone }, 
    { key: 'subnet2AvailabilityZone', value: vpc.subnet2AvailabilityZone }
  );

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('./build/cluster.yaml', clusterTemplate);

  await eksctl.createCluster('./build/cluster.yaml', config['clusterName'], false);
}

async function createVpc(config) {
  let vpcId = await aws.createVpc();

  await aws.enabledDnsHostnames(vpcId);

  let subnet1AvailabilityZone = 'b';
  let subnet2AvailabilityZone = 'a';
  let publicSubnetId1 = await aws.createSubnet(vpcId, config.masterZone + subnet1AvailabilityZone, '10.0.1.0/20', true);
  let privateSubnetId1 = await aws.createSubnet(vpcId, config.masterZone + subnet1AvailabilityZone, '10.0.16.0/20', false);
  let publicSubnetId2 = await aws.createSubnet(vpcId, config.masterZone + subnet2AvailabilityZone, '10.0.128.0/20', true);
  let privateSubnetId2 = await aws.createSubnet(vpcId, config.masterZone + subnet2AvailabilityZone, '10.0.144.0/20', false);

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
    subnet1AvailabilityZone: subnet1AvailabilityZone,
    subnet2AvailabilityZone: subnet2AvailabilityZone,
    securityGroupId: securityGroupId
  };
}

async function setLicenseSecret(config) {
  await kubectl.setGitSecret(config.licenseKey);
}

async function applyPolicies(config) {
  let policyInfo = await aws.createPolicy('EKS-S3-Access', './ellipsisDrive/s3-access-policy.json');
    
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
  await kubectl.apply('./ellipsisDrive/storage/ebs-sc.yaml');

  await kubectl.apply('./ellipsisDrive/storage/efs-sc.yaml');
  await kubectl.apply('./ellipsisDrive/storage/efs-finch-sc.yaml');

  await createEfsAndPersistentVolume(vpc, 'efs', config.masterZone);
  await createEfsAndPersistentVolume(vpc, 'efs-finch', config.masterZone);

  await kubectl.apply('./ellipsisDrive/storage/finch-1-pvc.yaml');
  await kubectl.apply('./ellipsisDrive/storage/etmpfs-pvc.yaml');

  let attempts = 0;
  let success = false;

  while (attempts < 5) {
    await kubectl.apply('./ellipsisDrive/storage/init-folders.yaml');

    success = await kubectl.waitForTermination('init-folders');

    await kubectl.deletePod('init-folders');

    if (success) {
      break;
    }
    
    attempts++;
  }

  if (!success) {
    throw new Error('Failed to init folders');
  }
}

async function createEfsAndPersistentVolume(vpc, baseName, region) {
  let efsId = await aws.createEfs(region);
  await aws.waitForEfsAvailable(efsId);
  await aws.attachEfsToSubnet(efsId, vpc.privateSubnetId1, vpc.securityGroupId);
  await aws.attachEfsToSubnet(efsId, vpc.privateSubnetId2, vpc.securityGroupId);

  let accessPointId = await aws.createEfsAccesspoint(efsId);

  let clusterTemplate = utilities.loadFile('./ellipsisDrive/storage/efs-pv.yaml');

  let substitutes = [{ key: 'storageClassName', value: baseName }, { key: 'efsId', value: efsId }, { key: 'accessPointId', value: accessPointId }];

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile(`./build/${baseName}-pv.yaml`, clusterTemplate);

  await kubectl.apply(`./build/${baseName}-pv.yaml`);
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
  let dataConfigMapTemplate = utilities.loadFile('./ellipsisDrive/owl/owl-data-config-map.yaml');

  let keys = [
    'masterZone',
    'apiUrl',
    'internalMailUsername',
    'noReplyMailUsername'
  ];

  let dataConfigMapsubstitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  dataConfigMapTemplate = utilities.substituteMulti(dataConfigMapTemplate, dataConfigMapsubstitutes);

  utilities.saveFile('./build/owl-data-config-map.yaml', dataConfigMapTemplate);

  let updatesConfigMapTemplate = utilities.loadFile('./ellipsisDrive/owl/owl-updates-config-map.yaml');

  let queries = versionManagement.getQueries('owl', config['ellipsisDriveVersion']);

  let updatesConfigMapSubstitutes = [{ key: 'updates', value: queries }];

  updatesConfigMapTemplate = utilities.substituteMulti(updatesConfigMapTemplate, updatesConfigMapSubstitutes);

  utilities.saveFile('./build/owl-updates-config-map.yaml', updatesConfigMapTemplate);

  await kubectl.apply('./ellipsisDrive/owl/owl-pdb.yaml');
  await kubectl.create('./ellipsisDrive/owl/owl-queries-config-map.yaml');
  await kubectl.create('./build/owl-data-config-map.yaml');
  await kubectl.create('./build/owl-updates-config-map.yaml');
  await kubectl.create('./ellipsisDrive/owl/icons-queries-config-map.yaml');
  await kubectl.apply('./ellipsisDrive/owl/owl.yaml');
}

async function createAlbatross(config) {
  await kubectl.apply('./ellipsisDrive/albatross/cluster-master-service-account.yaml');
  await applyVersionedYaml(config, './ellipsisDrive/albatross/vectorMaster/vector-master.yaml', 'vector-master');
  await applyVersionedYaml(config, './ellipsisDrive/albatross/rasterMaster/raster-master.yaml', 'raster-master');
  await applyVersionedYaml(config, './ellipsisDrive/albatross/pointCloudMaster/point-cloud-master.yaml', 'point-cloud-master');
  await applyVersionedYaml(config, './ellipsisDrive/albatross/exportMaster/export-master.yaml', 'export-master');
  await applyVersionedYaml(config, './ellipsisDrive/albatross/importMaster/import-master.yaml', 'import-master');
}

async function setupIngress(config) {
  await kubectl.apply('./ellipsisDrive/ingress/ingress-class.yaml');
}

async function setupCloudnativepg(config) {
  await kubectl.apply('https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.28/releases/cnpg-1.28.1.yaml', true);

  await kubectl.waitForCloudnativePG();
}

async function setupEllipsisConfigmap(config) {
  let clusterTemplate = utilities.loadFile('./ellipsisDrive/ellipsis.env');

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

  utilities.saveFile('./build/ellipsis.env', clusterTemplate);

  await kubectl.createConfigmap('ellipsis', { type: 'file', fileName: './build/ellipsis.env' });
}

async function createPigeon(config) {
  let certificateArn = await aws.createCertificate(config.apiUrl);

  let ingressTemplate = utilities.loadFile('./ellipsisDrive/pigeon/api/api-ingress.yaml');

  let keys = [
    'apiUrl'
  ];

  let ingressSubstitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  ingressSubstitutes.push({ key: 'apiCertificate', value: certificateArn });

  ingressTemplate = utilities.substituteMulti(ingressTemplate, ingressSubstitutes);

  utilities.saveFile('./build/api-ingress.yaml', ingressTemplate);

  await kubectl.apply('./ellipsisDrive/pigeon/api/api-pdb.yaml');
  await applyVersionedYaml(config, './ellipsisDrive/pigeon/api/api-deployment.yaml', 'api');
  await kubectl.apply('./ellipsisDrive/pigeon/api/api-service.yaml');
  await kubectl.apply('./build/api-ingress.yaml');

  await applyVersionedYaml(config, './ellipsisDrive/pigeon/actionsWriter/actions-writer-deployment.yaml', 'actions-writer');

  await applyVersionedYaml(config, './ellipsisDrive/pigeon/invalidator/invalidator-deployment.yaml', 'invalidator');

  await kubectl.apply('./ellipsisDrive/pigeon/flask/flask-pdb.yaml');
  await applyVersionedYaml(config, './ellipsisDrive/pigeon/flask/flask-deployment.yaml', 'flask');
  await kubectl.apply('./ellipsisDrive/pigeon/flask/flask-service.yaml');

  let configMapTemplate = utilities.loadFile('./ellipsisDrive/pigeon/cache-db/cache-updates-config-map.yaml');

  let queries = versionManagement.getQueries('cache-db', config['ellipsisDriveVersion']);

  let configMapSubstitutes = [{ key: 'updates', value: queries }];

  configMapTemplate = utilities.substituteMulti(configMapTemplate, configMapSubstitutes);

  utilities.saveFile('./build/cache-updates-config-map.yaml', configMapTemplate);

  await kubectl.apply('./ellipsisDrive/pigeon/cache-db/cache-db-pdb.yaml');
  await kubectl.apply('./ellipsisDrive/pigeon/cache-db/cache-queries-config-map.yaml');
  await kubectl.apply('./ellipsisDrive/pigeon/cache-db/cache-db-cloudnativepg.yaml');
  await kubectl.apply('./build/cache-updates-config-map.yaml');

  await applyVersionedYaml(config, './ellipsisDrive/pigeon/tileServiceCache/tile-service-cache-stateful-set.yaml', 'tile-service-cache');
  await kubectl.apply('./ellipsisDrive/pigeon/tileServiceCache/tile-service-cache-service.yaml');
}

async function createRooster(config) {
  await kubectl.apply('./ellipsisDrive/rooster/rooster-pdb.yaml');
  await kubectl.apply('./ellipsisDrive/rooster/rooster-queries-config-map.yaml');
  await kubectl.apply('./ellipsisDrive/rooster/rooster-service.yaml');
  await kubectl.apply('./ellipsisDrive/rooster/rooster.yaml');

  await kubectl.apply('./ellipsisDrive/rooster/compressedListFeatures/file-server-api-vector-service.yaml');
  await applyVersionedYaml(config, './ellipsisDrive/rooster/compressedListFeatures/file-server-api-vector-stateful-set.yaml', 'file-server-api-vector');
}

async function createPenguin(config) {
  let configTemplate = utilities.loadFile('./ellipsisDrive/penguin/penguin-config-map.yaml');

  let configKeys = [
    'apiUrl',
    'deploymentName'
  ];

  let configSubstitutes = configKeys.map((x) => { return { key: x, value: config[x] }; });

  configTemplate = utilities.substituteMulti(configTemplate, configSubstitutes);

  utilities.saveFile('./build/penguin-config-map.yaml', configTemplate);

  await kubectl.apply('./build/penguin-config-map.yaml');
  
  let certificateArn = await aws.createCertificate(config.frontendUrl);

  let clusterTemplate = utilities.loadFile('./ellipsisDrive/penguin/penguin-ingress.yaml');

  let keys = [
    'frontendUrl'
  ];

  let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

  substitutes.push({ key: 'frontendCertificate', value: certificateArn });

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  utilities.saveFile('./build/penguin-ingress.yaml', clusterTemplate);

  await kubectl.apply('./build/penguin-ingress.yaml');
  await kubectl.apply('./ellipsisDrive/penguin/penguin-service.yaml');
  await applyVersionedYaml(config, './ellipsisDrive/penguin/penguin.yaml', 'penguin');
}

async function createEmu(config) {
  await applyVersionedYaml(config, './ellipsisDrive/emu/bucketManagement/bucket-management-deployment.yaml', 'bucket-management');
  await applyVersionedYaml(config, './ellipsisDrive/emu/createPointCloudBounds/create-point-cloud-bounds-deployment.yaml', 'create-point-cloud-bounds');
  await applyVersionedYaml(config, './ellipsisDrive/emu/createRasterBounds/create-raster-bounds-deployment.yaml', 'create-raster-bounds');
  await applyVersionedYaml(config, './ellipsisDrive/emu/createShapeBounds/create-shape-bounds-deployment.yaml', 'create-shape-bounds');
  await applyVersionedYaml(config, './ellipsisDrive/emu/emailSender/email-sender-deployment.yaml', 'email-sender');
  await applyVersionedYaml(config, './ellipsisDrive/emu/fileSystemManagement/file-system-management-deployment.yaml', 'file-system-management');
  await applyVersionedYaml(config, './ellipsisDrive/emu/invalidationTaskAggregator/invalidation-task-aggregator-deployment.yaml', 'invalidation-task-aggregator');
  await applyVersionedYaml(config, './ellipsisDrive/emu/oauthManagement/oauth-management-deployment.yaml', 'oauth-management');
  await applyVersionedYaml(config, './ellipsisDrive/emu/processHardDeletes/process-hard-deletes-deployment.yaml', 'process-hard-deletes');
  await applyVersionedYaml(config, './ellipsisDrive/emu/processPathRename/process-path-rename-deployment.yaml', 'process-path-rename');
  await applyVersionedYaml(config, './ellipsisDrive/emu/searchUpdater/search-updater-deployment.yaml', 'search-updater');
  await applyVersionedYaml(config, './ellipsisDrive/emu/thumbnails/thumbnails-deployment.yaml', 'thumbnails');
  await applyVersionedYaml(config, './ellipsisDrive/emu/userDeletionManagement/user-deletion-management-deployment.yaml', 'user-deletion-management');
  await applyVersionedYaml(config, './ellipsisDrive/emu/userHistoryAppender/user-history-appender-deployment.yaml', 'user-history-appender');
}

async function createClusterWorkers(config) {
  await applyVersionedYaml(config, './ellipsisDrive/dodo/vector-worker.yaml', 'vector-worker');
  await applyVersionedYaml(config, './ellipsisDrive/hawk/raster-worker.yaml', 'raster-worker');
  await applyVersionedYaml(config, './ellipsisDrive/heron/point-cloud-worker.yaml', 'point-cloud-worker');
  await applyVersionedYaml(config, './ellipsisDrive/hummingbird/export-worker.yaml', 'export-worker');
  await applyVersionedYaml(config, './ellipsisDrive/sparrow/import-worker.yaml', 'import-worker');
}

async function applyVersionedYaml(config, file, package) {
  let version = versionManagement.getPackageVersion(package, config['ellipsisDriveVersion']);

  let clusterTemplate = utilities.loadFile(file);

  let substitutes = [{ key: 'version', value: version }];

  clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

  let targetFile = `./build/${file.split('/').slice(-1)[0]}`;

  utilities.saveFile(targetFile, clusterTemplate);

  await kubectl.apply(targetFile);
}