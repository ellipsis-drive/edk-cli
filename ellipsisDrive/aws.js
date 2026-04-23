const cmd = require('./cmd');
const utilities = require('./utilities');

const VPCCIDR = '10.0.0.0/16';

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
    let certificate = await cmd.executeCommandSimple(`aws acm request-certificate --domain-name ${name} --validation-method DNS`);

    certificate = JSON.parse(certificate);

    utilities.addToHistoryFile({ type: 'certificate', id: certificate.CertificateArn });

    return certificate.CertificateArn;
  },

  deleteCertificate: async (id) => {
    await cmd.executeCommandSimple(`aws acm delete-certificate --certificate-arn ${id}`);
  },

  createBucket: async (name, region) => {
    let buckets = await cmd.executeCommandSimple(`aws s3api list-buckets`);

    buckets = JSON.parse(buckets);

    if (!buckets.Buckets.find((x) => x.Name === name)) {
      await cmd.executeCommandSimple(`aws s3api create-bucket --bucket ${name} --region ${region} --create-bucket-configuration LocationConstraint=${region}`);
    }
  },

  createEfs: async (region) => {
    let efs = await cmd.executeCommandSimple(`aws efs create-file-system --encrypted --region ${region}`);

    efs = JSON.parse(efs);

    utilities.addToHistoryFile({ type: 'efs', id: efs.FileSystemId });

    return efs.FileSystemId;
  },

  deleteEfs: async (id, region) => {
    await cmd.executeCommandSimple(`aws efs delete-file-system --file-system-id ${id} --region ${region}`);
  },

  attachEfsToSubnet: async (fileSystemId, subnetId, securityGroupId) => {
    await cmd.executeCommandSimple(`aws efs create-mount-target --file-system-id ${fileSystemId} --subnet-id ${subnetId} --security-groups ${securityGroupId}`);
  },

  createEfsAccesspoint: async (fileSystemId) => {
    let accessPoint = await cmd.executeCommandSimple(`aws efs create-access-point --file-system-id ${fileSystemId} --posix-user Uid=1623,Gid=1623 --root-directory "Path=/data,CreationInfo={OwnerUid=1623,OwnerGid=1623,Permissions=0755}"`);
    accessPoint = JSON.parse(accessPoint);
    return accessPoint.AccessPointId;
  },

  waitForEfsAvailable: async (fileSystemId) => {
    while (true) {
      let fileSystems = await cmd.executeCommandSimple(`aws efs describe-file-systems`);
      fileSystems = JSON.parse(fileSystems);
      let fileSystem = fileSystems.FileSystems.find((x) => x.FileSystemId === fileSystemId);

      if (fileSystem.LifeCycleState === "available") {
        break;
      }
      else {
        console.log('lifecyclestate', fileSystem.LifeCycleState);
        await new Promise((x) => setTimeout(x, 500));
      }
    }
  },

  createVpc: async () => {
    let vpc = await cmd.executeCommandSimple(`aws ec2 create-vpc --cidr-block ${VPCCIDR}`);
    vpc = JSON.parse(vpc);
    utilities.addToHistoryFile({ type: 'vpc', id: vpc.Vpc.VpcId });
    return vpc.Vpc.VpcId;
  },

  deleteVpc: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 delete-vpc --vpc-id ${id}`);
  },

  enabledDnsHostnames: async (vpcId) => {
    await cmd.executeCommandSimple(`aws ec2 modify-vpc-attribute --vpc-id ${vpcId} --enable-dns-hostnames`);
  },

  addNfsSecurityGroup: async (vpcId, kubernetesClusterName) => {
    let securityGroup = await cmd.executeCommandSimple(`aws ec2 create-security-group --vpc-id ${vpcId} --group-name efs-nfs-sg --description "Allow NFS traffic for EFS"`);
    securityGroup = JSON.parse(securityGroup);

    // let cluster = await cmd.executeCommandSimple(`aws eks describe-cluster --name ${kubernetesClusterName}`);
    // cluster = JSON.parse(cluster);

    await cmd.executeCommandSimple(`aws ec2 authorize-security-group-ingress --group-id ${securityGroup.GroupId} --protocol tcp --port 2049 --cidr ${VPCCIDR}`);
    return securityGroup.GroupId;
  },

  createSubnet: async (vpcId, availabilityZone, CIDR, public) => {
    let subnet = await cmd.executeCommandSimple(`aws ec2 create-subnet --vpc-id ${vpcId} --cidr-block ${CIDR} --availability-zone ${availabilityZone} --tag-specifications ResourceType=subnet,Tags=[{Key=${public ? 'kubernetes.io/role/elb' : 'kubernetes.io/role/internal-elb'},Value=1}]`);
    subnet = JSON.parse(subnet);
    utilities.addToHistoryFile({ type: 'subnet', id: subnet.Subnet.SubnetId });
    return subnet.Subnet.SubnetId;
  },

  deleteSubnet: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 delete-subnet --subnet-id ${id}`);
  },

  createInternetGateway: async () => {
    let internetGateway = await cmd.executeCommandSimple(`aws ec2 create-internet-gateway`);
    internetGateway = JSON.parse(internetGateway);
    utilities.addToHistoryFile({ type: 'internetGateway', id: internetGateway.InternetGateway.InternetGatewayId });
    return internetGateway.InternetGateway.InternetGatewayId;
  },

  deleteInternetGateway: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 detach-internet-gateway --internet-gateway-id ${id}`);
    await cmd.executeCommandSimple(`aws ec2 delete-internet-gateway --internet-gateway-id ${id}`);
  },

  attachInternetGateway: async (vpcId, internetGatewayId) => {
    await cmd.executeCommandSimple(`aws ec2 attach-internet-gateway --vpc-id ${vpcId} --internet-gateway-id ${internetGatewayId}`);
  },

  createRouteTable: async (vpcId) => {
    let routeTable = await cmd.executeCommandSimple(`aws ec2 create-route-table --vpc-id ${vpcId}`);
    routeTable = JSON.parse(routeTable);
    utilities.addToHistoryFile({ type: 'routeTable', id: routeTable.RouteTable.RouteTableId });
    return routeTable.RouteTable.RouteTableId;
  },

  deleteRouteTable: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 delete-route-table --route-table-id ${id}`);
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
    utilities.addToHistoryFile({ type: 'ip', id: allocation.AllocationId });
    return allocation.AllocationId;
  },

  releaseAddress: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 release-address --allocation-id ${id}`);
  },

  createNATGateway: async (subnetId, allocationId) => {
    let natGateway = await cmd.executeCommandSimple(`aws ec2 create-nat-gateway --subnet-id ${subnetId} --allocation-id ${allocationId}`);
    natGateway = JSON.parse(natGateway);
    utilities.addToHistoryFile({ type: 'NAT', id: natGateway.NatGateway.NatGatewayId });
    return natGateway.NatGateway.NatGatewayId;
  },

  deleteNATGateway: async (id) => {
    await cmd.executeCommandSimple(`aws ec2 delete-nat-gateway --nat-gateway-id ${id}`);
  },

  waitForNAT: async (NATId) => {
    await cmd.executeCommandSimple(`aws ec2 wait nat-gateway-available --nat-gateway-ids ${NATId}`);
  }
}