const fs = require('fs');
const getDirName = require('path').dirname;
const crypto = require('crypto');

const HISTORY_PATH = './ellipsisDrive/history';

module.exports = {
  historyPath: HISTORY_PATH,

  loadFile: (path) => {
    let text = fs.readFileSync(path);

    text = text.toString();

    return text;
  },

  addToHistoryFile: (object) => {
    fs.appendFileSync(HISTORY_PATH, JSON.stringify(object) + '\n');
  },

  generatePassword: (length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]?';
    const charsLength = chars.length;

    let result = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % charsLength];
    }

    return result;
  },

  saveFile: (path, contents) => {
    fs.mkdir(getDirName(path), { recursive: true }, function (err) {
      if (err) {
        throw(err);
      }

      fs.writeFileSync(path, contents);
    });
  },

  substituteMulti: (text, keyValues) => {
    let alteredText = text;

    keyValues.forEach((x) => {
      alteredText = substitute(alteredText, x.key, x.value)
    });

    return alteredText
  },

  substitute: substitute,
  isValid: isValid,

  intStringtoInt: (arg) => { //tries to convert int string to int
    return (/^-?\d+$/.test(arg) && Number.isSafeInteger(parseInt(arg))) ? parseInt(arg) : arg;
  },
}

function substitute(text, key, value) {
  let alteredText = text.replaceAll(`<<<${key}>>>`, value);

  return alteredText;
}

function isValid(arg, type, optional) {
  let defined = arg !== undefined && arg !== null;
  let valid = false;

  if (defined) {
    if (!type) {
      type = 'int';
    }

    switch (type) {
      case 'int':
      case 'integer':
        valid = Number.isInteger(arg) && Number.isSafeInteger(arg);
        break;
      case 'float':
        valid = typeof arg === 'number' && !Number.isNaN(arg) && arg < Number.MAX_VALUE && arg > -Number.MAX_VALUE;
        break;
      case 'string':
        valid = typeof arg === 'string' || arg instanceof String;
        break;
      case 'object':
        valid = !Array.isArray(arg) && typeof arg === 'object';
        break;
      case 'boolean':
      case 'bool':
        valid = typeof arg === 'boolean';
        break;
      case 'array':
        valid = Array.isArray(arg);
        break;
      case 'uuid':
        valid = typeof arg === 'string' || arg instanceof String;
        if (valid) {
          valid = arg.match(v4) ? true : false;
        }
        break;
      case 'date':
        valid = moment(arg, moment.ISO_8601, true).isValid();
        break;
      case 'jsonString':
        try {
          JSON.parse(arg);
          valid = true;
        }
        catch {
          valid = false;
        }
        break;
    }
  }

  if (optional) {
    return {
      valid: !defined || valid,
      defined: defined
    };
  }
  else {
    return valid;
  }
}
