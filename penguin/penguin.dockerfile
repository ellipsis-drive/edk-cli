FROM nginx
COPY build /usr/share/nginx/html
COPY app.conf /etc/nginx/conf.d/default.conf