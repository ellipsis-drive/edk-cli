const fs = require('fs');
const stripJsonComments = require('strip-json-comments').default;

module.exports = () => {
  let config = fs.readFileSync('../config.jsonc');

  config = config.toString();

  config = JSON.parse(stripJsonComments(config));
  
  return config;
}