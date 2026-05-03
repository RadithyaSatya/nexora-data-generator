FROM nginx:1.27-alpine

RUN apk add --no-cache apache2-utils

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY infra/nginx/docker-entrypoint.sh /usr/local/bin/nexora-nginx-entrypoint.sh
RUN chmod +x /usr/local/bin/nexora-nginx-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/nexora-nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
