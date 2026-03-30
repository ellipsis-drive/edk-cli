const ellipsis = require('./ellipsisCluster');
const loadConfig = require('./loadConfig');

test();

async function test() {
  let config = loadConfig();
  
  let vpc = await ellipsis.createVpc(config);
  // let vpc = {
  //   vpcId: 'vpc-08837623255ff4c2c',
  //   privateSubnetId1: 'subnet-0b2aed27d0692fdd7',
  //   privateSubnetId2: 'subnet-0154a36317c79f907',
  //   publicSubnetId1: 'subnet-0b684b0c622d70450', 
  //   publicSubnetId1: 'subnet-09e0cf7cbbd3fb243'
  // }
  // await ellipsis.createCluster(config, vpc);
  console.log(vpc);
}