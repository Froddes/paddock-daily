# Paddock Daily — CMS

Backend de [Paddock Daily](https://paddock-daily.com/): **Directus** como CMS headless sobre **PostgreSQL**, levantado con Docker Compose. Es donde el equipo editorial escribe y publica, y de donde el frontend en Astro lee el contenido en build time.

🔗 Panel: [cms.paddock-daily.com](https://cms.paddock-daily.com/)

![Directus](https://img.shields.io/badge/Directus-11-263238?logo=directus&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Tunnel-F38020?logo=cloudflare&logoColor=white)

## Arquitectura

```
Redacción ──► Directus (panel + API REST) ──► PostgreSQL
                     │
                     └──► Astro lee los items publicados en cada build
```

| Servicio | Imagen | Función |
|---|---|---|
| `database` | `postgres:16-alpine` | Colecciones y contenido, con healthcheck |
| `directus` | `directus/directus:11` | API REST y panel de administración en el puerto 8055 |

En producción corre en un servidor propio (Raspberry Pi) y se publica con **Cloudflare Tunnel**, sin abrir puertos en el router.

## Modelo de contenido

| Colección | Contenido | Relaciones |
|---|---|---|
| `articles` | Noticias en Markdown, con estado, destacado y tiempo de lectura | M2O `categories`, M2O `authors`, M2M `tags` |
| `opinion_columns` | Columnas de opinión firmadas | M2O `categories`, M2O `authors` |
| `categories` | F1, WEC, DTM, IMSA, NASCAR… | — |
| `authors` | Nombre, cargo y biografía | — |
| `tags` | Etiquetas libres | — |

El detalle de cada campo está en [`DIRECTUS-COLLECTIONS.md`](./DIRECTUS-COLLECTIONS.md).

## Automatización editorial (Directus Flows)

Al crear o editar un artículo, los Flows rellenan solos lo repetitivo:

- **Fecha de publicación**, en hora de Madrid, al pasar a `published`.
- **Tiempo de lectura** calculado a partir del cuerpo.
- **Slug** generado desde el título si se deja vacío.
- **Aviso a n8n al publicar** para lanzar un rebuild del frontend (preparado, aún inactivo).

## Roles y dashboard

- **Administrator:** acceso completo.
- **Redactor:** CRUD de artículos y columnas; categorías y autores en solo lectura; puede crear tags pero no editarlas.
- **Lectura pública** del contenido, para que Astro lo consuma en build time sin token.
- **Dashboard de Insights** con 6 paneles para el día a día: borradores pendientes, publicados este mes, total de artículos, artículos por categoría, actividad reciente y últimos artículos.

## Puesta en marcha

1. Crea un `.env` junto al `docker-compose.yml`:

   ```env
   DB_USER=directus
   DB_PASSWORD=          # contraseña fuerte
   DB_DATABASE=paddockdaily

   DIRECTUS_KEY=         # openssl rand -hex 16
   DIRECTUS_SECRET=      # openssl rand -hex 32

   ADMIN_EMAIL=
   ADMIN_PASSWORD=

   PUBLIC_URL=http://localhost:8055
   ```

2. Levanta el stack:

   ```bash
   docker compose up -d
   curl http://localhost:8055/server/ping   # → pong
   ```

3. Entra en `http://localhost:8055/admin` con el email y la contraseña de admin.

4. Opcional: carga contenido de prueba con `node scripts/seed-directus.mjs`. El script es idempotente: busca por slug antes de crear.

El despliegue en la Raspberry Pi con Cloudflare Tunnel está paso a paso en [`MIGRACION-RASPBERRY.md`](./MIGRACION-RASPBERRY.md).

## Archivos

| Archivo | Contenido |
|---|---|
| `docker-compose.yml` | Stack de Directus y PostgreSQL |
| `DIRECTUS-COLLECTIONS.md` | Modelo de datos, roles, dashboard y flows documentados |
| `MIGRACION-RASPBERRY.md` | Despliegue en producción con Cloudflare Tunnel |
| `scripts/seed-directus.mjs` | Carga de contenido de prueba vía API REST |

> Las credenciales viven solo en `.env`, que está en `.gitignore`. Los volcados de base de datos y los uploads no se versionan.

---

Parte de [Paddock Daily](../README.md) · Desarrollado por **Francisco Javier Rodríguez Martín** ([@Froddes](https://github.com/Froddes))
