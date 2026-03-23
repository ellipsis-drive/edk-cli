const utilities = require('./utilities');
const kubectl = require('./kubectl');
const eksctl = require('./eksctl');

module.exports = {
  create: (config) => {
    let clusterTemplate = utilities.loadFile('../cluster.yaml.template');

    let keys = [
      'clusterName',
      'kubernetesVersion'
    ];
    
    let substitutes = keys.map((x) => { return { key: x, value: config[x] }; });

    clusterTemplate = utilities.substituteMulti(clusterTemplate, substitutes);

    utilities.saveFile('../build/cluster.yaml', clusterTemplate);

    eksctl.createCluster('../build/cluster.yaml', true);
  }
}