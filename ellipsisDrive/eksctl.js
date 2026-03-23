const cmd = require('./cmd');

module.exports = {
  createCluster: async (clusterConfigPath, dryRun = true) => {
    let output = await cmd.executeCommandSimple(
      `eksctl create cluster -f ${clusterConfigPath} ${dryRun ? '--dry-run' : ''}`
    );

    // console.log(output);
  }
}