const spawn = require('child_process').spawn;
const moment = require('moment');

module.exports = {
  executeCommand: executeCommand,

  executeCommandSimple: async (command, noLog = false, abortSignal = null) => {
    return await executeCommand('sh', ['-c', command], false, noLog, abortSignal);
  },

  executeCommandSudo: async (command) => {
    return await executeCommand('sudo', ['sh', '-c', command]);
  },

  executeRemoteCommand: async (host, command, opts) => {
    let zone = null;
    let shell = false;
    let docker = false;
    let noLog = false;
    
    if (opts) {
      zone = opts.zone;
      shell = opts.shell;
      docker = opts.docker;
      noLog = opts.noLog;
    }

    if (process.env.CLOUD === 'google') {
      return await executeCommand(
        'ssh',
        [
          '-i',
          `~/.ssh/google_compute_engine`,
          '-o',
          `StrictHostKeyChecking=accept-new`,
          host,
          command
        ],
        shell,
        noLog
      ); 
    }
    else {
      let args = [];

      if (docker) {
        args = args.concat([
          `-p`,
          `2755`,
          `-i`,
          `~/.ssh/ellipsis-admin`,
          `ellipsis-admin@${host}`,
          command
        ]);
      }
      else {
        args = args.concat([
          `-i`, 
          `~/.ssh/ellipsis-admin`,
          `ubuntu@${host}`,
          command
        ]);
      }

      return await executeCommand('ssh', args, shell, noLog);
    }
  },

  sleep: sleep
};

async function executeCommand(cmd, args, shell = false, noLog = false, abortSignal = null) {
  let commandLog = cmd;
  let log = !noLog;

  const MAX_LOG_LENGTH = 600;

  if (log) {
    if (args) {
      for (let i = 0; i < args.length; i++) {
        if (commandLog.length > MAX_LOG_LENGTH) {
          break;
        }
  
        let arg = args[i];
  
        if (arg.length > MAX_LOG_LENGTH) {
          arg = arg.substring(0, MAX_LOG_LENGTH);
        }
  
        commandLog += ' ' + arg;
      }
    }
    
    if (commandLog.length > MAX_LOG_LENGTH) {
      commandLog += ' (truncated)';
    }
  
    console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')}:`, commandLog);
  }

  let childProcess = spawn(cmd, args, {}, shell);
  let processDone = false;

  let promises = [];
  
  let processPromise = new Promise((resolve, reject) => {
    let outputStrings = [];
    let errorStrings = [];

    childProcess.stdout.on('data', (output) => {
      if (!noLog) {
        process.stdout.write(output);
      }

      output = output.toString();
      outputStrings.push(output);
    });

    childProcess.stderr.on('data', (output) => {
      if (!noLog) {
        process.stderr.write(output);
      }
      
      output = output.toString();
      errorStrings.push(output);
    });

    childProcess.on('close', (code) => {
      outputStrings = outputStrings.join('');

      if (Array.isArray(errorStrings)) {
        errorStrings = errorStrings.join('');
      }

      if (code === 0) {
        resolve(outputStrings);
      } 
      else {
        let exceptionError = new Error(errorStrings);
        exceptionError.code = code;
        exceptionError.outputStrings = outputStrings;
        reject(exceptionError);
      }
    });

    childProcess.on('error', (err) => {
      errorStrings = errorStrings.join('');

      if (log) {
        console.log(`Command has errored.`);
        console.log(err);
        console.log(errorStrings);
      }

      reject(new Error(errorStrings));
    });
  }).finally(() => processDone = true);

  promises.push(processPromise);

  if (abortSignal) {
    let abortCheckPromise = new Promise(async (resolve, reject) => {
      while (!processDone) {
        // console.log(abortSignal.aborted);
        if (abortSignal.aborted) {
          console.log(`Process abort check killing process`, commandLog);
          childProcess.kill();
          break;
        }
  
        await sleep(1000);
      }

      console.log(`Process abort check resolving`, commandLog);
  
      resolve();
    });

    promises.push(abortCheckPromise);
  }

  try {
    return await Promise.race(promises); 
  } 
  catch (e) {
    if (log) {
      if (e.message) {
        console.error(e.message);
      }
      else {
        console.error(e);
      }
    }
    
    throw e;
  }
}

function sleep(ms, log = false) {
  if (log) {
    console.log(`Sleeping for ${ms} milliseconds`);
  }
  
  return new Promise((resolve) => setTimeout(resolve, ms));
}