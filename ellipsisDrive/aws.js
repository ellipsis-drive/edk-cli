const cmd = require('./cmd');

module.exports = {
  createPolicy: async (name, documentPath) => {
    let policyInfo = await cmd.executeCommandSimple(`aws iam create-policy --policy-name ${name} --policy-document file://${documentPath}`);
    
    policyInfo = JSON.parse(policyInfo);

    return policyInfo
  },

  createCertificate: async (name, documentPath) => {
    let certificate = await cmd.executeCommandSimple(`aws acm request-certificate --domain-name ${name}`);

    certificate = JSON.parse(certificate);

    return certificate.CertificateArn;
  },

  createBucket: async (name) => {
    await cmd.executeCommandSimple(`aws s3api create-bucket --bucket ${name} --region ${region}`);
  }
}