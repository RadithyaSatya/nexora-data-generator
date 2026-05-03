FROM nginx:1.27-alpine

RUN apk add --no-cache apache2-utils gettext

COPY infra/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY infra/nginx/docker-entrypoint.sh /usr/local/bin/nexora-nginx-entrypoint.sh
RUN chmod +x /usr/local/bin/nexora-nginx-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/nexora-nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
