const utilities = require('./utilities');
const kubectl = require('./kubectl');
const aws = require('./aws');
const eksctl = require('./eksctl');
const cmd = require('./cmd');
  

async function sandbox() {
  let attempts = 0;

  while (attempts < 5) {
    await kubectl.apply('../storage/init-folders.yaml');

    let success = await kubectl.waitForTermination('init-folders');

    await kubectl.deletePod('init-folders');

    if (success) {
      console.log('Success');
      break;
    }

    console.log('Failure');
    
    attempts++;
  }
}

sandbox();
