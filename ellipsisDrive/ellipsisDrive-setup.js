const { program } = require('commander');

const loadConfig = require('./loadConfig');

const ellipsisCluster = require('./ellipsisCluster');

async function ellipsisDrive() {
  program
    .version('1.0.0')
    .name('Ellipsis Drive Kubernetes - Setup')
    .description('Ellipsis Drive Kubertes setup commands')

  program.parse();

  let config = loadConfig();

  ellipsisCluster.create(config);

  console.log('Done');
}

ellipsisDrive();

