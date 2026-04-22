#!/bin/bash

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <image> <pg_password>"
  exit 1
fi

docker run \
  -d \
  -e POSTGRES_PASSWORD=$2 \
  -p 5432:5432 \
  $1 \
  -c wal_level=logical