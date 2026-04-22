const { Command } = require('commander');
const program = new Command();

const loadConfig = require('./ellipsisDrive/loadConfig');
const ellipsisCluster = require('./ellipsisDrive/ellipsisCluster');

async function ellipsisDrive() {
  program
    .version('1.0.0')
    .name('Ellipsis Drive Kubernetes')
    .description('Ellipsis Drive Kubernetes setup and maintenance tool.')
    .executableDir('./ellipsisDrive')

  const configure = program.command('configure').action(() => {
    let config = loadConfig();
    ellipsisCluster.configure(config);

    // console.log('Configure done');
  });

  configure.command('validate').action(() => {
    let config = loadConfig();
    ellipsisCluster.validateConfig(config);

    // console.log('Validate done');
  });

  const setup = program.command('setup').action(() => {
    let config = loadConfig();
    ellipsisCluster.create(config);

    // console.log('Setup done');
  });

  program.parse();
}

ellipsisDrive();

