const { program } = require('commander');

async function ellipsisDrive() {
  program
    .version('1.0.0')
    .name('Ellipsis Drive Kubernetes')
    .description('Ellipsis Drive Kubernetes setup and maintenance tool.')
    .command('setup', 'Perform setup operations')

  program.parse();
}

ellipsisDrive();

