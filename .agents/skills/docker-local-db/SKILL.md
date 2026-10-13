---
name: docker-local-db
description: 'How to spin up a new local Docker container for a database or common backing service (PostgreSQL, Redis, MinIO/S3, MySQL, MongoDB, RabbitMQ, etc.) following the user''s convention: inspect existing containers (running and stopped) to pick the next free host port for that image family, name the container as <project>-<image> in kebab-case, and — for engines DBeaver can connect to (Postgres, MySQL/MariaDB, MongoDB, Redis) — register the connection in DBeaver automatically via its CLI. Use whenever asked to spin up, levantar, or create a local database/cache/storage container with Docker.'
---

# Contenedores locales de Docker: convención de nombrado y puertos

El usuario reutiliza siempre las mismas imágenes por defecto (PostgreSQL, Redis, MinIO, etc.) para levantar servicios locales por proyecto. La única variación entre contenedores es el **nombre** (según el proyecto) y el **puerto** (incremental, para no chocar con contenedores anteriores). Esta skill define cómo calcular ambos antes de crear un contenedor nuevo.

## 1. Inspeccionar el estado actual

Antes de crear cualquier contenedor, revisa **todos** los existentes, activos e inactivos:

```bash
docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Ports}}"
```

Si `docker ps` falla (daemon apagado, o en WSL sin integración activada), avísalo y detente — no adivines puertos sin datos reales.

## 2. Determinar la familia de imagen

Agrupa por familia, no por tag exacto — `postgres:16`, `postgres:15-alpine` y `postgres:latest` cuentan como la misma familia a efectos de puerto. Empareja por el nombre base de la imagen (antes de `:`), ignorando el tag.

## 3. Calcular el puerto

1. De los contenedores (activos + inactivos) cuya imagen pertenece a esa familia, extrae el puerto del **host** del mapeo (`{{.Ports}}` muestra algo como `0.0.0.0:5438->5432/tcp` → el puerto host es `5438`).
2. Si hay contenedores previos de esa familia: **nuevo puerto = máximo puerto host existente + 1**.
3. Si es la primera vez que se usa esa imagen (no hay ningún contenedor previo de esa familia): usa el **puerto por defecto de la imagen** como punto de partida.

### Puertos por defecto de referencia

| Imagen | Puerto(s) por defecto |
|---|---|
| postgres | 5432 |
| mysql / mariadb | 3306 |
| redis | 6379 |
| mongo | 27017 |
| minio | 9000 (API) y 9001 (consola) — ver nota abajo |
| rabbitmq | 5672 (AMQP) y 15672 (panel de administración) |
| elasticsearch | 9200 |

**Imágenes con más de un puerto (minio, rabbitmq):** ambos puertos se incrementan juntos, manteniendo el mismo offset entre sí. Si el último contenedor de minio usó `9010:9000` y `9011:9001`, el siguiente usa `9020:9000` / `9021:9001` — no solo el primer puerto.

### Ejemplo real (con datos de proyectos existentes del usuario)

Contenedores de PostgreSQL ya usados: `5432` (Pocket_MVP), `5433` (CADET), `5438` (orientacion-vocacional), `5439` (veterinaria). El siguiente contenedor de Postgres que se cree, sin importar el proyecto, va en **`5440`**.

## 4. Nombrar el contenedor

Patrón fijo: **`<nombre-proyecto>-<imagen>`**, todo en minúsculas, kebab-case. Ejemplos: `cadet-postgres`, `pocket-redis`, `orientacion-postgres`.

- El nombre del proyecto es el del directorio raíz del repo (o como el usuario lo llame en la conversación), normalizado a kebab-case.
- La imagen es el nombre base (`postgres`, `redis`, `minio`), no el tag completo.

Si el proyecto ya tiene más de un contenedor de la misma imagen (poco común, pero posible), agrega un sufijo numérico: `cadet-postgres-2`.

## 5. Volúmenes

Nombra el volumen igual que el contenedor + `-data`, para que quede claro a qué pertenece: `cadet-postgres-data`. Evita volúmenes anónimos salvo que el usuario pida explícitamente datos efímeros.

## 6. docker-compose vs `docker run`

Si el proyecto ya tiene un `docker-compose.yml` (varios del usuario lo tienen), **agrega el servicio ahí** en vez de un `docker run` suelto — mantiene consistencia con cómo ya levanta el resto del stack ese proyecto. Aplica el mismo nombre de servicio/contenedor y la misma lógica de puerto. Solo usa `docker run` directo si el proyecto no tiene compose o el usuario pide explícitamente un contenedor aislado.

## 7. Antes de ejecutar

Muestra el comando completo (`docker run ...` o el bloque de `docker-compose.yml`) con el nombre y puerto ya calculados, para que quede claro qué se va a crear, antes de ejecutarlo. No hace falta pedir confirmación explícita como con escrituras en base de datos — crear un contenedor es una acción de bajo riesgo y fácilmente reversible (`docker rm`) — pero sí debe quedar visible antes de correr.

## 8. Registrar la conexión en DBeaver

Después de crear (y confirmar que levantó) un contenedor de un motor que DBeaver sabe conectar — **Postgres, MySQL/MariaDB, MongoDB, Redis** — registra la conexión automáticamente, sin que el usuario tenga que abrir DBeaver y cargarla a mano. **MinIO (S3) y RabbitMQ quedan fuera de este paso**: no son tipos de conexión que DBeaver maneje, así que no intentes forzar una.

### No hace falta instalar nada aparte

El CLI **es el mismo ejecutable de escritorio**, no un paquete separado. En esta máquina está en `C:\Program Files\DBeaver\dbeaverc.exe` (variante que no abre una ventana de consola nueva). DBeaver solo está instalado en Windows en este entorno — si el contenedor se creó desde una sesión de WSL, igual apunta al ejecutable de Windows vía `/mnt/c/...`, no hay DBeaver nativo en WSL para esto.

### Comando

```powershell
& "C:\Program Files\DBeaver\dbeaverc.exe" -con "driver=<driver>|host=localhost|port=<puerto>|database=<db>|user=<user>|password=<password>|name=<nombre-contenedor>|savePassword=true|create=true|save=true" -nosplash
```

- **`name`**: usa el mismo nombre que el contenedor (`<proyecto>-<imagen>`, sección 4) — así la conexión en DBeaver queda identificable de un vistazo.
- **`host`/`port`**: `localhost` y el puerto host ya calculado en la sección 3 (no el puerto interno del contenedor).
- **`user`/`password`/`database`**: los mismos valores que se pasaron al crear el contenedor (`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, `MYSQL_*`, `MONGO_INITDB_*`, etc.) — ya los tienes de haber armado el `docker run`/compose, no hace falta volver a preguntarlos.
- **`savePassword=true`**: guarda la contraseña en el `credentials-config.json` cifrado de DBeaver, para que la conexión quede lista para usar sin pedir password cada vez — aceptable para contenedores locales de desarrollo, igual que ya se asume en `postgresql` para el flujo de `psql`.
- **`create=true|save=true`**: crea la conexión si no existe y la persiste en el workspace activo.

### Driver por motor

| Servicio | `driver=` |
|---|---|
| PostgreSQL | `postgres-jdbc` |
| MySQL / MariaDB | `mysql8` |
| MongoDB | `mongodb` |
| Redis | `redis` |

Estos son los IDs confirmados en el `data-sources.json` de este usuario para Postgres/MySQL; Mongo/Redis no tenían conexión previa que confirmar, así que la primera vez que se use cada uno hay que verificar que la conexión aparece en DBeaver (o que al menos no fallan el comando) — si DBeaver rechaza el id, revisa `dbeaverc.exe -h` y ajusta.

### Antes de ejecutar

Igual que con el contenedor: muestra el comando completo con los valores ya resueltos antes de correrlo. Es una acción de bajo riesgo (agrega una conexión local, no toca datos), así que no requiere confirmación explícita — pero debe quedar visible.
