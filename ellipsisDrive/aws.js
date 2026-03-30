const cmd = require('./cmd');

module.exports = {
  createPolicy: async (name, documentPath) => {
    let policyInfo = await cmd.executeCommandSimple(`aws iam list-policies`);

    policyInfo = JSON.parse(policyInfo);

    let existingPolicy = policyInfo.Policies.find((x) => x.PolicyName === name);

    if (existingPolicy) {
      return { Policy: existingPolicy };
    }

    policyInfo = await cmd.executeCommandSimple(`aws iam create-policy --policy-name ${name} --policy-document file://${documentPath}`);
    
    policyInfo = JSON.parse(policyInfo);

    return policyInfo
  },

  createCertificate: async (name, documentPath) => {
    let certificate = await cmd.executeCommandSimple(`aws acm request-certificate --domain-name ${name}`);

    certificate = JSON.parse(certificate);

    return certificate.CertificateArn;
  },

  createBucket: async (name, region) => {
    let buckets = await cmd.executeCommandSimple(`aws s3api list-buckets`);

    if (!buckets.Buckets.find((x) => x.Name === name)) {
      await cmd.executeCommandSimple(`aws s3api create-bucket --bucket ${name} --region ${region} --create-bucket-configuration LocationConstraint=${region}`);
    }
  },

  createVpc: async () => {
    let vpc = await cmd.executeCommandSimple(`aws ec2 create-vpc --cidr-block 10.0.0.0/16`);
    vpc = JSON.parse(vpc);
    return vpc.Vpc.VpcId;
  },

  createSubnet: async (vpcId, availabilityZone, CIDR, public) => {
    let subnet = await cmd.executeCommandSimple(`aws ec2 create-subnet --vpc-id ${vpcId} --cidr-block ${CIDR} --availability-zone ${availabilityZone} --tag-specifications ResourceType=subnet,Tags=[{Key=${public ? 'kubernetes.io/role/elb' : 'kubernetes.io/role/internal-elb'},Value=1}]`);
    subnet = JSON.parse(subnet);
    return subnet.Subnet.SubnetId;
  },

  createInternetGateway: async () => {
    let internetGateway = await cmd.executeCommandSimple(`aws ec2 create-internet-gateway`);
    internetGateway = JSON.parse(internetGateway);
    return internetGateway.InternetGateway.InternetGatewayId;
  },

  attachInternetGateway: async (vpcId, internetGatewayId) => {
    await cmd.executeCommandSimple(`aws ec2 attach-internet-gateway --vpc-id ${vpcId} --internet-gateway-id ${internetGatewayId}`);
  },

  createRouteTable: async (vpcId) => {
    let routeTable = await cmd.executeCommandSimple(`aws ec2 create-route-table --vpc-id ${vpcId}`);
    routeTable = JSON.parse(routeTable);
    return routeTable.RouteTable.RouteTableId;
  },

  createRoute: async (routeTableId, destination) => {
    await cmd.executeCommandSimple(`aws ec2 create-route --route-table-id ${routeTableId} --destination-cidr-block 0.0.0.0/0 --${destination.type} ${destination.id}`);
  },

  associateRouteTable: async (routeTableId, subnetId) => {
    await cmd.executeCommandSimple(`aws ec2 associate-route-table --route-table-id ${routeTableId} --subnet-id ${subnetId}`);
  },

  allocateAddress: async () => {
    let allocation = await cmd.executeCommandSimple(`aws ec2 allocate-address --domain vpc`);
    allocation = JSON.parse(allocation);
    return allocation.AllocationId;
  },

  createNATGateway: async (subnetId, allocationId) => {
    let natGateway = await cmd.executeCommandSimple(`aws ec2 create-nat-gateway --subnet-id ${subnetId} --allocation-id ${allocationId}`);
    natGateway = JSON.parse(natGateway);
    return natGateway.NatGateway.NatGatewayId;
  },

  waitForNAT: async (NATId) => {
    await cmd.executeCommandSimple(`aws ec2 wait nat-gateway-available --nat-gateway-ids ${NATId}`);
  }
}