const ellipsis = require('./ellipsisCluster');
const loadConfig = require('./loadConfig');

test();

async function test() {
  let config = loadConfig();
  
  // let vpc = await ellipsis.createVpc(config);
  let vpc = {
    vpcId: 'vpc-07612785d90b16c0b',
    publicSubnetId1: 'subnet-087708b71235ea3a4',
    privateSubnetId1: 'subnet-0b2dc16f96a3eabfa',
    publicSubnetId2: 'subnet-0b701969531d9c4a4',
    privateSubnetId2: 'subnet-0a4be94f055a021ea'
  }
  // await ellipsis.createCluster(config, vpc);
  await ellipsis.setLicenseSecret(config);
  await ellipsis.applyPolicies(config);
  console.log(vpc);
}