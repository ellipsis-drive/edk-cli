const { Command } = require('commander');
const program = new Command();

const loadConfig = require('./ellipsisDrive/loadConfig');
const ellipsisCluster = require('./ellipsisDrive/ellipsisCluster');

async function ellipsisDrive() {
  program
    .version('1.0.0')
    .name('node ellipsisDrive.js')
    .description('Ellipsis Drive Kubernetes Command Line Interface (EDK CLI)')
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

  const deleteCluster = program.command('delete').action(() => {
    let config = loadConfig();
    ellipsisCluster.deleteCluster(config);

    // console.log('Delete done');
  });

  const version = program.command('version').action(() => {
    const version = require('./package.json').version;
    console.log(`Ellipsis Drive Kubernetes Command Line Interface (EDK CLI)`);
    console.log(`Version ${version}`);
  });

  program.parse();
}

ellipsisDrive();

