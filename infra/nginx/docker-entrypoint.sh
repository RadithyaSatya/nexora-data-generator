#!/bin/sh
set -eu

if [ -z "${APP_BASIC_AUTH_USERNAME:-}" ] || [ -z "${APP_BASIC_AUTH_PASSWORD:-}" ] || [ -z "${APP_DOMAIN:-}" ]; then
  echo "APP_BASIC_AUTH_USERNAME, APP_BASIC_AUTH_PASSWORD, and APP_DOMAIN must be set" >&2
  exit 1
fi

HTPASSWD_FILE="/etc/nginx/.htpasswd"
TEMPLATE_FILE="/etc/nginx/templates/default.conf.template"
OUTPUT_FILE="/etc/nginx/conf.d/default.conf"

htpasswd -bc "$HTPASSWD_FILE" "$APP_BASIC_AUTH_USERNAME" "$APP_BASIC_AUTH_PASSWORD"
envsubst '${APP_DOMAIN}' < "$TEMPLATE_FILE" > "$OUTPUT_FILE"

exec "$@"
