#!/bin/sh

SAFE_POD_NAME=$(echo "$POD_NAME" | tr '-' '_')

psql -U ellipsis_app -d ellipsis -c "
    CREATE SUBSCRIPTION user_subscription_${SAFE_POD_NAME}
    CONNECTION 'host=owl port=${POSTGRES_HOST_PORT} user=${POSTGRES_APP_USER} dbname=${POSTGRES_DB} password=${POSTGRES_APP_PASS_OWL}'
    PUBLICATION users_publication;
"