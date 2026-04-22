FROM postgres:18

ENV POSTGRES_DB=ellipsis
ENV POSTGRES_USER=ellipsis_app

COPY ./initScripts/ /docker-entrypoint-initdb.d/