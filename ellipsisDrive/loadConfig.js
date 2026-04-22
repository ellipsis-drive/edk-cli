const fs = require('fs');
const { parse } = require('jsonc-parser');

module.exports = () => {
  let config = fs.readFileSync('./config.jsonc');

  config = config.toString();

  config = parse(config);
  
  return config;
}