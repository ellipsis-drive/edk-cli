const cmd = require('./cmd');

module.exports = {
  apply: async (path) => {
    await cmd.executeCommandSimple(`kubectl apply -f ${path}`);
  }
}