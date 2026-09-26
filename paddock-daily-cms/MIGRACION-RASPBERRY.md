# Migrar Directus a la Raspberry Pi

Checklist para pasar Directus de tu Docker Desktop (Windows) a la Pi,
publicado en `https://cms.paddock-daily.es` vía Cloudflare Tunnel — igual
patrón que ya usas con `n8n.froddes.com`. Se monta limpio (sin migrar datos
del Directus actual, que es de pruebas) y luego se añade contenido de
prueba directamente en el nuevo.

## 1. Copiar el stack a la Pi

Desde tu PC, copia esta carpeta (`paddock-daily-cms/`) a la Pi — por SSH,
SCP, o el método que ya uses para tus otros proyectos:

```bash
scp -r paddock-daily-cms pi@<ip-de-tu-pi>:~/paddock-daily-cms
```

## 2. Configurar variables de entorno

Ya en la Pi:

```bash
cd ~/paddock-daily-cms
cp .env.example .env
nano .env
```

Rellena `DB_PASSWORD`, `SECRET` (`openssl rand -hex 32`), `ADMIN_EMAIL` y
`ADMIN_PASSWORD` con valores reales. No reutilices el `SECRET` de tu
Directus local — invalida sesiones y tokens si lo cambias más tarde, así
que mejor generarlo bien la primera vez.

## 3. Levantar el stack

```bash
docker compose up -d
docker compose logs -f directus   # hasta ver "Server started"
```

Comprueba que responde localmente:

```bash
curl http://localhost:8055/server/ping
```

Si usas Portainer en vez de la terminal, puedes desplegar este mismo
`docker-compose.yml` como un nuevo Stack desde su interfaz.

## 4. Publicarlo con Cloudflare Tunnel

Añade una entrada más al `config.yml` del `cloudflared` que ya tienes
corriendo en la Pi (el mismo que usa `n8n.froddes.com`), junto a las que ya
existan:

```yaml
ingress:
  - hostname: cms.paddock-daily.es
    service: http://localhost:8055
  - hostname: n8n.froddes.com
    service: http://localhost:5678
  - service: http_status:404
```

Crea el registro DNS para el nuevo hostname (una vez, con el nombre de tu
túnel):

```bash
cloudflared tunnel route dns <nombre-del-tunel> cms.paddock-daily.es
```

Reinicia el servicio de `cloudflared` para que recoja el nuevo `ingress`:

```bash
sudo systemctl restart cloudflared
```

Verifica desde fuera de la red de la Pi (móvil con datos, por ejemplo):
`https://cms.paddock-daily.es/server/ping` debería responder `pong`.

## 5. Entrar y recrear el contenido

Entra en `https://cms.paddock-daily.es/admin` con el `ADMIN_EMAIL` /
`ADMIN_PASSWORD` del `.env`. Como es una instalación limpia, recrea aquí las
colecciones, roles y Flows documentados en `DIRECTUS-COLLECTIONS.md`, y
añade contenido de prueba (categorías, un par de artículos, autores) para
poder verificar el deploy de principio a fin.

## 6. Apuntar Netlify al nuevo Directus

En Netlify → tu sitio → **Site configuration → Environment variables**,
añade o edita:

```
PUBLIC_DIRECTUS_URL = https://cms.paddock-daily.es
```

Redeploy (Deploys → Trigger deploy → Deploy site). El build ahora sí podrá
alcanzar Directus, porque es una URL pública en vez de `localhost`.

## 7. Cuando esté verificado

- Deja el Directus del Docker Desktop parado o bórralo cuando confirmes que
  todo funciona bien desde la Pi — evita tener dos fuentes de verdad del
  contenido.
- Añade `cms.paddock-daily.es` a los sitios de confianza si más adelante
  activas autenticación adicional (Cloudflare Access, etc.) — no es
  necesario para el lanzamiento, pero es una opción a futuro si quieres
  cerrar el acceso al panel `/admin` solo a vosotros.
