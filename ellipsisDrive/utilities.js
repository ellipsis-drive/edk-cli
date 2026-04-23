const fs = require('fs');
const getDirName = require('path').dirname;
const crypto = require('crypto');

const HISTORY_PATH = './ellipsisDrive/history.json';

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

  substitute: substitute
}

function substitute(text, key, value) {
  let alteredText = text.replaceAll(`<<<${key}>>>`, value);

  return alteredText;
}