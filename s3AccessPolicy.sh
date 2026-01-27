aws iam create-policy \
    --policy-name EKS-S3-Access \
    --policy-document file://s3-access-policy.json

eksctl create iamserviceaccount \
  --name s3-access-sa \
  --namespace default \
  --cluster ellipsis-drive \
  --attach-policy-arn arn:aws:iam::758738941592:policy/EKS-S3-Access \
  --approve