# Paddock Daily — Astro + Directus

Migración de la maqueta HTML/CSS/JS (Fase 0-1) a Astro, consumiendo
contenido real de Directus (Fase 2) en vez de datos de ejemplo.

## Cómo levantar esto en local

Necesitas Directus corriendo (ver `../paddock-daily-web/docker-compose.yml`
si no lo tienes ya levantado) y accesible en `http://localhost:8055` (o
cambia la URL en `.env`).

```bash
npm install
cp .env.example .env     # ajusta PUBLIC_DIRECTUS_URL si hace falta
npm run dev               # http://localhost:4321, con recarga en caliente
npm run build              # genera dist/ (sitio 100% estático)
npm run preview             # sirve dist/ tal cual quedaría en producción
```

Como es un sitio estático (SSG), **cada página se genera en build time**
con los datos que hubiera en Directus en ese momento. Un artículo nuevo o
un cambio de contenido no aparece en producción hasta el siguiente
`npm run build` + deploy. El flow "Aviso a n8n al publicar" (ver
`DIRECTUS-COLLECTIONS.md` en `paddock-daily-web/`) es el enganche natural
para disparar ese rebuild automáticamente el día que se conecte a tu
proveedor de hosting (la mayoría deja iniciar un build vía webhook).

## Estructura

```
src/
  lib/directus.js       → único punto de contacto con la API de Directus
                           (getArticles, getCategories, getOpinionColumns...)
  layouts/Layout.astro  → <head>, fuentes, tema claro/oscuro, Header+Footer
  components/
    Header.astro          → variantes full/simple, nav de categorías dinámica
    Footer.astro           → variantes full/simple
    StoryCard.astro          → tarjeta de artículo reutilizada en home/categoría
    OpinionCard.astro         → tarjeta de columna de opinión
    ThumbPlaceholder.astro     → gráfico SVG de referencia (sustituir por
                                  fotografía real en la fase 5)
  pages/
    index.astro                  → Home
    categoria/[slug].astro       → una página por categoría (getStaticPaths)
    articulo/[slug].astro        → una página por artículo publicado
    opinion/index.astro          → listado de Opinión (tema oscuro)
    opinion/[slug].astro         → columna individual (tema oscuro)
    sobre-nosotros.astro         → equipo editorial dinámico (colección authors)
    buscar.astro                 → búsqueda en cliente sobre datos reales
                                    (TODO fase 4: sustituir por Pagefind)
  styles/style.css              → el mismo CSS de la fase de maquetación, sin tocar
```

## Qué cambió respecto a la maqueta HTML/CSS/JS

- `assets/js/include.js` (fetch de partials) **desaparece** — Header/Footer
  son componentes Astro normales.
- Los `<article>` de ejemplo y el dataset hardcodeado de `search.js`
  **desaparecen** — todo sale de Directus vía `src/lib/directus.js`.
- El body de artículos/columnas es Markdown en Directus; se convierte a
  HTML en build time con `marked` (ver `articulo/[slug].astro` y
  `opinion/[slug].astro`).
- Las cifras de "artículos por categoría" en Home ya no están hardcodeadas
  — vienen de una consulta de agregación real a Directus
  (`getArticleCountsByCategory`).
- El equipo editorial de "Sobre nosotros" sale de la colección `authors`,
  no está escrito a mano.
- El buscador sigue siendo un filtro en cliente (como en la fase 1), pero
  ahora filtra sobre el contenido real embebido en build time, no sobre
  el dataset de 11 artículos de ejemplo.

## Pendiente para producción (fases 4-5 del roadmap)

- Pagefind sustituyendo el filtro de `buscar.astro`.
- Webhook real de n8n → Brevo en el formulario de newsletter de Home.
- Fotografía editorial sustituyendo `ThumbPlaceholder`.
- Disparar `npm run build` automáticamente desde el flow de Directus al
  publicar (rebuild en el hosting).
- `sitemap.xml`, `robots.txt`, JSON-LD `Article` (Astro los genera con
  integraciones estándar — `@astrojs/sitemap`, por ejemplo).
- Huecos de anuncios (header, sidebar, in-article) preparados en el layout
  para conectar AdSense/Ezoic cuando haya tráfico suficiente — no tiene
  sentido montarlo sin visitas todavía.
