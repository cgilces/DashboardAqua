#!/bin/sh
# Bloquea desde afuera (interfaz publica eth0) el acceso directo a los
# puertos publicados por Docker que ya se sirven via nginx-proxy-manager
# (npm-app) por nombre de contenedor en aqua-network. No toca npm-app
# (80/81/443) ni portainer (8000/9443).
#
# Idempotente: borra sus propias reglas (marcadas con el comment "aqua-fw")
# antes de re-insertarlas, para poder correrse de nuevo sin duplicar si
# cambian las IPs internas (ej. tras recrear un contenedor).
#
# Se re-ejecuta solo en cada arranque de docker.service via el override en
# /etc/systemd/system/docker.service.d/aqua-fw.conf.

set -e

TAG="aqua-fw"

# Borrar reglas previas con nuestro tag (de mayor a menor numero de linea,
# para que borrar una no corra la numeracion de las que faltan borrar).
iptables -L DOCKER-USER --line-numbers -n 2>/dev/null \
  | awk -v tag="$TAG" '$0 ~ tag {print $1}' \
  | sort -rn \
  | while read -r n; do iptables -D DOCKER-USER "$n"; done

add_rule() {
  # $1 = IP interna del contenedor, $2 = puerto interno, $3 = descripcion
  iptables -I DOCKER-USER 1 -i eth0 -d "$1" -p tcp --dport "$2" \
    -m comment --comment "$TAG: $3" -j DROP
}

add_rule 172.18.0.11 80   "dashboard_frontend (pub 3001)"
add_rule 172.18.0.9  5000 "dashboard_backend (pub 5000)"
add_rule 172.18.0.12 5001 "pedidos_backend (pub 5001)"
add_rule 172.18.0.6  5000 "frecuencia_backend (pub 53005)"
add_rule 172.18.0.8  80   "frecuencia_frontend (pub 53006)"
add_rule 172.18.0.4  6379 "frecuencia_redis (pub 53007)"
add_rule 172.18.0.7  5100 "flotas_backend (pub 53008)"
add_rule 172.18.0.5  80   "flotas_frontend (pub 53009)"
