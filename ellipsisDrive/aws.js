const cmd = require('./cmd');

module.exports = {
  createPolicy: async (name, documentPath) => {
    let policyInfo = await cmd.executeCommandSimple(`aws iam create-policy --policy-name ${name} --policy-document file://${documentPath}`);
    
    policyInfo = JSON.parse(policyInfo);

    return policyInfo
  }
}