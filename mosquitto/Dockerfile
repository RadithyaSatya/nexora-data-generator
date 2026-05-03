FROM eclipse-mosquitto:2

COPY mosquitto/docker-entrypoint.sh /usr/local/bin/nexora-mosquitto-entrypoint.sh
RUN chmod +x /usr/local/bin/nexora-mosquitto-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/nexora-mosquitto-entrypoint.sh"]
CMD ["mosquitto", "-c", "/mosquitto/config/mosquitto.conf"]
