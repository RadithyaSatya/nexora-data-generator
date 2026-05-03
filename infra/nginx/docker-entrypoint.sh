#!/bin/sh
set -eu

if [ -z "${APP_BASIC_AUTH_USERNAME:-}" ] || [ -z "${APP_BASIC_AUTH_PASSWORD:-}" ]; then
  echo "APP_BASIC_AUTH_USERNAME and APP_BASIC_AUTH_PASSWORD must be set" >&2
  exit 1
fi

HTPASSWD_FILE="/etc/nginx/.htpasswd"

htpasswd -bc "$HTPASSWD_FILE" "$APP_BASIC_AUTH_USERNAME" "$APP_BASIC_AUTH_PASSWORD"

exec "$@"
