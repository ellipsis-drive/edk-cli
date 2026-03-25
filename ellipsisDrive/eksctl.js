const cmd = require('./cmd');

module.exports = {
  createCluster: async (clusterConfigPath, dryRun = true) => {
    let output = await cmd.executeCommandSimple(
      `eksctl create cluster -f ${clusterConfigPath} ${dryRun ? '--dry-run' : ''}`
    );

    // console.log(output);
  },

  createServiceAccount: async (name, clusterName, policyArn) => {
    await cmd.executeCommandSimple(`eksctl create iamserviceaccount --name ${name} --namespace default --cluster ${clusterName} --attach-policy-arn ${policyArn} --approve`); 
  }
}