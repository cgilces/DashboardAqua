# ops/ — scripts de infraestructura del droplet

Copias versionadas de scripts que viven en el droplet fuera del árbol de la
app (no se ejecutan como parte del build/deploy de `docker-compose.yml`).
Si el droplet se reconstruye, esto es lo que hay que volver a instalar a mano.

## `docker-user-firewall.sh` — firewall real para puertos publicados por Docker

Docker bypasea `ufw` (publica puertos vía `DNAT`/`FORWARD`, no vía la cadena
`INPUT` que gobierna `ufw`). Este script inserta reglas `DROP` directo en la
cadena `DOCKER-USER` — el gancho que Docker expone para que un admin sí pueda
filtrar tráfico a contenedores — bloqueando desde la interfaz pública
(`eth0`) el acceso directo a los puertos que ya se sirven vía
nginx-proxy-manager (`3001, 5000, 5001, 53005-53009`), sin tocar Portainer
(`8000/9443`) ni `npm-app` (`80/81/443`).

Cada regla filtra por **IP interna + puerto interno exactos** del contenedor,
no solo por puerto — varios contenedores comparten puerto interno 80/5000, y
filtrar solo por puerto habría bloqueado también tráfico legítimo (incluido
`npm-app` mismo).

Instalación en el droplet:

```bash
cp ops/docker-user-firewall.sh /usr/local/sbin/docker-user-firewall.sh
chmod +x /usr/local/sbin/docker-user-firewall.sh

mkdir -p /etc/systemd/system/docker.service.d
cp ops/docker.service.d-aqua-fw.conf /etc/systemd/system/docker.service.d/aqua-fw.conf
systemctl daemon-reload

/usr/local/sbin/docker-user-firewall.sh   # aplicar ahora
```

El hook en `docker.service.d/aqua-fw.conf` (`ExecStartPost`) hace que se
vuelva a ejecutar solo en cada arranque de `docker.service` (boot o
`systemctl restart docker`), para que sobreviva un reboot.

**Si algún contenedor bloqueado se recrea**, su IP interna en `aqua-network`
puede cambiar (`docker inspect <contenedor> --format '{{.NetworkSettings.Networks.aqua-network.IPAddress}}'`)
— hay que actualizar las IPs en el script (en el droplet, `/usr/local/sbin/docker-user-firewall.sh`,
y reflejar el cambio acá) y volver a correrlo. Es idempotente (se puede correr
las veces que haga falta, no duplica reglas — las identifica por el comment
`aqua-fw` y las borra antes de re-insertarlas).

## `docker.service.d-aqua-fw.conf`

Override de systemd para `docker.service` (en el droplet vive como
`/etc/systemd/system/docker.service.d/aqua-fw.conf`) — solo agrega el
`ExecStartPost` que dispara `docker-user-firewall.sh`.
