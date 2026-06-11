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

  const update = program.command('update').action(() => {
    let config = loadConfig();
    ellipsisCluster.upgrade(config['ellipsisDriveVersion']);
  });

  update.command('pull').action(() => {
    ellipsisCluster.pull();
  });

  const editConfigMap = program
    .command('edit <kind> <target>')
    .option('-s, --set <pairs...>', 'Variables to set (e.g., -s a=1 b=2)')
    .option('-u, --unset <variables...>', 'Variables to unset')
    .action(async (kind, target, options) => {
      console.log('kind', kind);
      console.log('target', target);
      console.log('options', options);
      let setEdits = options.set ? options.set.map((x) => { return { action: "set", target: x.split('=')[0], value: x.split('=')[1] }}) : [];
      let deleteEdits = options.unset ? options.unset.map((x) => { return { action: "delete", target: x } }) : [];
      console.log('edits', [...setEdits, ...deleteEdits]);
      let editOpts = {
        target: target,
        kind: 'ConfigMap',
        edits: [...setEdits, ...deleteEdits]
      };

      try {
        await ellipsisCluster.edit(editOpts);
      } catch (error) {
        program.error(`Failed to edit: ${error.message}`, {
          exitCode: 1
        });
      }
    });

  program.parse();
}

ellipsisDrive();

