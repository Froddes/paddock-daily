# Paddock Daily — Directus (modelo de datos, roles, dashboard y flows)

Este documento describe la configuración completa de Directus para Paddock
Daily: colecciones y campos, roles y permisos, el dashboard de Insights, y
los flows de automatización. Sirve como referencia para reconstruir el CMS
si hace falta (como ya tuvimos que hacer una vez tras perder el volumen de
Docker), y como documentación de cómo funciona cada pieza.

## Colecciones

### articles

| Campo | Tipo / Interfaz | Notas |
|---|---|---|
| `id` | Integer (auto) | PK, sistema |
| `title` | String (Input) | Título del artículo |
| `slug` | String (Input, Slugify) | Único; autogenerado por el flow "Auto-generación de slug" si se deja vacío |
| `dek` | Text | Subtítulo/entradilla corta |
| `body` | Markdown | **Required**. Cuerpo del artículo, se convierte a HTML en build time con `marked` |
| `category` | M2O → `categories` | Relación obligatoria |
| `author` | M2O → `authors` | Relación obligatoria |
| `tags` | M2M → `tags` (vía `articles_tags`) | Opcional, varias por artículo |
| `featured` | Boolean | Marca artículo destacado (hero/portada) |
| `featured_image` | (reservado para Fase 5 — fotografía real) | Por ahora sin usar; `ThumbPlaceholder` cubre el hueco |
| `published_date` | DateTime (sin zona horaria) | Autogenerado por los flows de auto-fecha (ver más abajo). Directus lo guarda y muestra literal, sin convertir — por eso el script genera ya la hora de Madrid, no UTC. |
| `reading_time` | Integer | Autogenerado por los flows de auto-cálculo de reading time |
| `status` | Status (sistema) | `draft` / `published` / `archived` |
| Sort, Date Created, Date Updated | Sistema | Botones de un clic en la cabecera del listado de campos |

### categories

| Campo | Tipo / Interfaz | Notas |
|---|---|---|
| `id` | Integer (auto) | PK |
| `name` | String | Ej. "Fórmula 1" |
| `slug` | String (Input, Slugify) | Ej. `f1`; autogenerado por el flow de slug |
| `description` | Text | Opcional, usada en la cabecera de categoría |

### tags

| Campo | Tipo / Interfaz | Notas |
|---|---|---|
| `id` | Integer (auto) | PK |
| `name` | String | Etiqueta libre |

### authors

| Campo | Tipo / Interfaz | Notas |
|---|---|---|
| `id` | Integer (auto) | PK |
| `name` | String | Nombre visible |
| `bio` | Text | Usada en "Sobre nosotros" y en la caja de autor de artículos/opinión |
| `role` | String | Ej. "Redacción", "Columnista de Fórmula 1" |

### opinion_columns

| Campo | Tipo / Interfaz | Notas |
|---|---|---|
| `id` | Integer (auto) | PK |
| `title` | String | |
| `slug` | String (Input, Slugify) | Autogenerado por el flow de slug |
| `dek` | Text | |
| `body` | Markdown | Igual que en `articles` |
| `category` | **M2O** → `categories` | ⚠️ Debe ser Many to One, no Many to Many — una columna tiene una sola categoría. Si Directus crea una colección puente (`opinion_columns_categories`), el campo se creó mal: bórralo y vuelve a crearlo como M2O. |
| `author` | **M2O** → `authors` | ⚠️ Mismo cuidado que `category` — una columna tiene un solo autor. |
| `published_date` | DateTime | Manual por ahora (no tiene flow de auto-fecha propio) |
| `status` | Status (sistema) | `draft` / `published` |

### Colecciones puente (autogeneradas, no tocar)

- `articles_tags` — M2M real entre `articles` y `tags` (`articles_id`, `tags_id`). Esta sí es correcta como colección puente.

## Roles y permisos

**Administrator**: acceso completo, sin restricciones.

**Redactor** (rol único — un solo redactor usando la plataforma por ahora):
- `articles`: CRUD completo (Create, Read, Update, Delete)
- `opinion_columns`: CRUD completo
- `categories`: solo lectura
- `authors`: solo lectura
- `tags`: **Create-only** (puede añadir tags nuevas al escribir, pero no editar/borrar las existentes)
- `directus_dashboards` / `directus_panels`: permiso de lectura explícito (colecciones de sistema, ocultas por defecto — hay que activarlas a mano para que el Redactor vea el dashboard de Insights)

## Dashboard de Insights

Dashboard con 6 paneles pensado para el día a día de redacción:

1. **Metric — Borradores pendientes**: Collection `articles`, Field `id`, Aggregate Function `Count`, Filter `status equals draft`.
2. **Metric — Publicados este mes**: Collection `articles`, Field `id`, Aggregate Function `Count`, Filter `status equals published` + `published_date` dentro del mes actual (variable dinámica `$NOW(-1 month)` — solo válida en filtros, no en payloads de operación).
3. **Metric — Total artículos**: Collection `articles`, Field `id`, Aggregate Function `Count`, sin filtro.
4. **Bar Chart — Artículos por categoría**: Collection `articles`, Group by `category`, Y-Axis Function `Count` (o `Max` según el eje elegido).
5. **Line Chart — Actividad reciente**: Collection `articles`, Group Precision `Hour`, Date Range `Past 1 Week`.
6. **List — Mis últimos artículos**: Collection `articles`, ordenado por fecha de actualización descendente, Display Template con título + estado.

> ⚠️ Bug conocido: si dejas el campo "Field" de un panel Metric vacío, Directus construye una query GraphQL inválida con `*` y falla con `Syntax Error: Unexpected character: "*"`. Selecciona siempre un campo explícito (`id`).

## Flows

Hay 6 flows activos (más uno Inactive a la espera de la URL real de n8n).
Varios vienen **en pareja** (uno para `items.create`, otro para
`items.update`) porque Directus no permite mezclar los dos eventos en un
mismo Trigger sin liarse con `$trigger.key` (singular, solo en `create`)
vs `$trigger.keys` (array, solo en `update`) — ver gotchas al final.

### 1a. Auto-fecha de publicación (al editar)
- Trigger: Event Hook · Action · `items.update` · `articles`
- Condition (`es_published`): `{"$trigger":{"payload":{"status":{"_eq":"published"}}}}`
- Read Data (`current_item`): Full Access, IDs `{{$trigger.keys[0]}}`, fields `["published_date"]`
- Condition (`sin_fecha`): `{"$last":{"published_date":{"_null":true}}}`
- Run Script (`now_ts`) — genera la hora ya en Madrid, no en UTC (Directus no convierte los campos DateTime sin zona horaria):
  ```js
  module.exports = async function (data) {
    const now = new Date();
    const madrid = now.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
    return madrid.replace(' ', 'T');
  };
  ```
- Update Data: Full Access, IDs `{{$trigger.keys[0]}}`, **Emit Events OFF**, payload `{"published_date":"{{now_ts}}"}`

### 1b. Auto-fecha de publicación (al crear)
- Trigger: Event Hook · Action · `items.create` · `articles`
- Condition (`es_published`): mismo filtro que 1a
- Run Script (`now_ts`): mismo código que 1a (hora de Madrid)
- Update Data: Full Access, IDs `{{$trigger.key}}` (singular), **Emit Events OFF**, payload `{"published_date":"{{now_ts}}"}`
- No necesita Read Data ni la Condition `sin_fecha`: en un `create` el artículo nunca tiene fecha previa.

### 2a. Auto-cálculo de reading time (al editar)
- Trigger: Event Hook · Action · `items.update` · `articles`
- Read Data (`current_body`): Full Access, IDs `{{$trigger.keys[0]}}`, fields `["body"]`
- Run Script (`minutos_lectura`): cuenta palabras del body / 200, `Math.max(1, Math.ceil(...))`
- Update Data: Full Access, IDs `{{$trigger.keys[0]}}`, **Emit Events OFF**, payload `{"reading_time":"{{minutos_lectura}}"}`

### 2b. Auto-cálculo de reading time (al crear)
- Trigger: Event Hook · Action · `items.create` · `articles`
- Run Script (`minutos_lectura`) — como `body` es obligatorio, ya viene en el propio payload del trigger, sin Read Data:
  ```js
  module.exports = async function (data) {
    const body = data.$trigger.payload.body || '';
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  };
  ```
- Update Data: Full Access, IDs `{{$trigger.key}}` (singular), **Emit Events OFF**, payload `{"reading_time":"{{minutos_lectura}}"}`

### 3. Aviso a n8n al publicar (Status: **Inactive** — placeholder, pendiente Fase 4)
- Trigger: Event Hook · Action · `items.update` · `articles`
- Condition (`es_published`): igual que en el flow 1a
- Read Data (`articulo`): Full Access, IDs `{{$trigger.keys[0]}}`, Query:
  ```json
  { "fields": ["title", "slug", "dek", "category"] }
  ```
- Webhook / Request URL:
  - Method: `POST`
  - URL: placeholder (`https://tu-n8n.tudominio.com/webhook/paddock-daily-publish`), pendiente de sustituir por la URL real cuando se conecte n8n en Fase 4
  - Headers: `Content-Type: application/json`
  - Body:
    ```json
    {
      "title": "{{articulo.title}}",
      "slug": "{{articulo.slug}}",
      "dek": "{{articulo.dek}}",
      "category": "{{articulo.category}}"
    }
    ```
- Mantener este flow **Inactive** en el listado hasta tener la URL real, para que no falle en cada publicación.

### 4. Auto-generación de slug
- Trigger: Event Hook · Action · `items.create` · Collections: `articles`, `categories`, `opinion_columns`
  (se monta una vez por colección — mismo patrón, cambiando solo el Collection del Trigger y del Update Data)
- Run Script (`generar_slug`):
  ```js
  module.exports = async function (data) {
    const slugify = (str) =>
      str
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const payload = data.$trigger.payload;

    // si ya escribiste un slug a mano, no lo tocamos
    if (payload.slug && payload.slug.trim() !== '') {
      return null;
    }

    return slugify(payload.title || '');
  };
  ```
- Condition (`necesita_slug`): `{"$last": {"_nnull": true}}` — corta el flow si el script devolvió `null`
- Update Data: Collection igual que el Trigger, Permissions Full Access, IDs `{{$trigger.key}}` (singular), **Emit Events OFF**, payload `{"slug": "{{generar_slug}}"}`

### Gotchas recurrentes de los Flows

1. **No mezcles `items.create` e `items.update` en el mismo Trigger** si vas a usar `{{$trigger.key}}` / `{{$trigger.keys[0]}}` en las operaciones siguientes. `items.update` expone `$trigger.keys` (array, plural); `items.create` expone `$trigger.key` (singular). Si están mezclados en un solo Trigger, el que no toca resuelve a `"undefined"` sin avisar y las operaciones fallan por permisos. Mejor: un flow por evento, como en 1a/1b y 2a/2b.
2. **Referenciar el Key de una operación custom dentro de una Condition no funciona.** Una Condition solo puede usar variables reservadas (`$trigger`, `$last`, `$accountability`, `$env`) como claves de nivel superior en su filtro JSON — nunca el nombre de una operación anterior. Para condicionar sobre el resultado de una operación anterior, usa `$last`.
3. **`Emit Events` debe estar desactivado** en cualquier operación Update Data que escriba en la misma colección que disparó el flow — si no, se dispara a sí mismo en bucle infinito.
4. **`{{$now}}` / `$NOW` solo funciona dentro de filtros** (p. ej. `$NOW(-1 month)`), nunca dentro del payload de una operación de escritura — para eso hace falta un Run Script intermedio.
5. **Un Run Script empieza con `module.exports = async function (data) { ... }`** — un `return` suelto sin la función alrededor da `SyntaxError: Illegal return statement`.
6. **Los campos DateTime sin zona horaria no se convierten al mostrarlos.** Si generas la fecha con `new Date().toISOString()` (UTC) y Madrid está en UTC+1/+2, verás la hora desfasada. Genera directamente la hora de Madrid en el script (ver 1a/1b) en vez de UTC.
7. En el formulario de una operación **Read Data**, si no aparece un campo "Fields" separado, se especifica dentro del propio **Query** como clave `"fields"` (junto a `"filter"` si hace falta).

## Pendiente / próximos pasos

- [ ] Recrear las relaciones M2O de `category`/`author` en `opinion_columns` si se crearon como M2M por error (borrar los campos y las colecciones puente `opinion_columns_categories`/`opinion_columns_authors`, volver a crear como M2O).
- [ ] Sustituir la URL placeholder del flow 3 (Aviso a n8n) cuando se conecte n8n de verdad, y activar el flow.
- [ ] `npm run seed` para repoblar contenido de ejemplo una vez el modelo de datos esté completo.
- [ ] Revisar si `opinion_columns` necesita también sus propios flows de auto-fecha (actualmente `published_date` ahí es manual).