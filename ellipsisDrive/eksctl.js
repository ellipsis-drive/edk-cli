const cmd = require('./cmd');
const utilities = require('./utilities');

module.exports = {
  createCluster: async (clusterConfigPath, clusterName, dryRun = true) => {
    let output = await cmd.executeCommandSimple(
      `eksctl create cluster -f ${clusterConfigPath} ${dryRun ? '--dry-run' : ''}`
    );

    utilities.addToHistoryFile({ type: 'eks', id: undefined });

    // console.log(output);
    
    // if (!dryRun) {
    //   while (true) {
    //     let cluster = await cmd.executeCommandSimple(`aws eks describe-cluster --name ${clusterName}`); // eksctl get does not give enough info
    //     cluster = JSON.parse(cluster);
  
    //     if (cluster.cluster.status === "ACTIVE") {
    //       break;
    //     }
    //     else {
    //       console.log('cluster', cluster);
    //       await new Promise((x) => setTimeout(x, 30000)); // check every 30 seconds since this step will probably take a while
    //     }
    //   }
    // }
  },

  createServiceAccount: async (name, clusterName, policyArn) => {
    await cmd.executeCommandSimple(`eksctl create iamserviceaccount --name ${name} --namespace default --cluster ${clusterName} --attach-policy-arn ${policyArn} --approve`); 
  },

  deleteCluster: async (name, region) => {
    let output = await cmd.executeCommandSimple(
      `eksctl delete cluster --name ${name} --region ${region} --disable-nodegroup-eviction --wait`
    );
  }
}