const fs = require('fs');
const getDirName = require('path').dirname;

module.exports = {
  loadFile: (path) => {
    let text = fs.readFileSync(path);

    text = text.toString();

    return text;
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