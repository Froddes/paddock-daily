# Paddock Daily — Frontend

Web pública de [Paddock Daily](https://paddock-daily.com/), construida con **Astro** como sitio estático (SSG). Cada página se genera en build time con el contenido publicado en el [CMS en Directus](../paddock-daily-cms/), y los datos de carrera en vivo se piden desde el navegador a APIs públicas.

🔗 **[paddock-daily.com](https://paddock-daily.com/)**

![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![Directus](https://img.shields.io/badge/Directus-API_REST-263238?logo=directus&logoColor=white)
![Umami](https://img.shields.io/badge/Umami-analítica-000000)
![AdSense](https://img.shields.io/badge/Google_AdSense-4285F4?logo=googleadsense&logoColor=white)

## Funcionalidades

- **Contenido desde Directus:** artículos, columnas de opinión, categorías, autores y tags. El Markdown se convierte a HTML en build time con `marked`.
- **Páginas generadas:** portada, una por categoría (paginada), artículo, opinión, autores en "Sobre nosotros" y páginas legales.
- **Resultados en vivo:** calendario, cuenta atrás, clasificaciones y últimos resultados de F1, NASCAR y MotoGP, pedidos en el navegador para estar siempre al día sin rebuild.
- **Búsqueda en cliente** con MiniSearch sobre el contenido real.
- **Tema claro y oscuro** persistente.
- **SEO:** sitemap automático, `robots.txt`, metadatos Open Graph y Twitter, y datos estructurados JSON-LD.
- **Anuncios con AdSense** configurables por variables de entorno, sin tocar código, y desactivados por defecto.
- **Banner de cookies** que guarda la decisión del usuario y la expone a los scripts antes de instalar cookies no esenciales.
- **Analítica autoalojada** con Umami, que solo se carga si está configurada.

## Fuentes de datos

| Fuente | Qué aporta | Cuándo se consulta |
|---|---|---|
| Directus (`src/lib/directus.js`) | Todo el contenido editorial | En build time |
| [Jolpica-F1](https://api.jolpi.ca) (`f1-api.js`) | Calendario, sesiones, resultados y clasificaciones de F1 | En el navegador |
| API pública de ESPN (`nascar-api.js`) | Próxima carrera y clasificación de NASCAR | En el navegador |
| API no oficial de motogp.com (`motogp-api.js`) | Próximo GP, calendario y clasificación de pilotos | En el navegador |

Las APIs de carrera son públicas, sin key y sin contrato: si alguna deja de responder, su widget se retira sin afectar al resto del sitio.

## Estructura

```
src/
├── lib/
│   ├── directus.js        → único punto de contacto con la API de Directus
│   ├── f1-api.js, nascar-api.js, motogp-api.js → datos de carrera
│   ├── ads.js             → configuración de AdSense por variables de entorno
│   └── markdown.js, categoryOrder.js, categoryImages.js
├── layouts/Layout.astro   → <head>, SEO, tema, analítica, anuncios, Header y Footer
├── components/            → StoryCard, OpinionCard, RaceCenterCard, AdSlot, CookieConsent…
└── pages/
    ├── index.astro
    ├── categoria/[slug].astro y categoria/[slug]/pagina/[page].astro
    ├── categoria/{f1,nascar,motogp}/resultados.astro
    ├── articulo/[slug].astro
    ├── opinion/index.astro y opinion/[slug].astro
    ├── buscar.astro, sobre-nosotros.astro
    ├── ads.txt.ts         → /ads.txt generado a partir del ID de AdSense
    └── aviso-legal, privacidad, cookies, terminos
```

## Puesta en marcha

Necesitas el [CMS](../paddock-daily-cms/) levantado y accesible.

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:4321
npm run build      # genera dist/, sitio 100 % estático
npm run preview    # sirve dist/ tal como quedaría en producción
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `PUBLIC_DIRECTUS_URL` | URL de Directus. Por defecto, `http://localhost:8055` |
| `PUBLIC_UMAMI_URL`, `PUBLIC_UMAMI_WEBSITE_ID` | Activan la analítica con Umami |
| `PUBLIC_ADSENSE_CLIENT` | ID de editor: añade la meta de verificación y genera `/ads.txt`, sin cargar scripts |
| `PUBLIC_ADS_ENABLED` | `true` carga AdSense y pinta los huecos; activar solo con el sitio aprobado |
| `PUBLIC_ADSENSE_SLOT_*` | ID de cada bloque de anuncios: dentro del artículo, al final, barra lateral y portada |

## Publicación de contenido

Al ser SSG, un artículo nuevo aparece en producción tras el siguiente build y deploy. Directus tiene preparado un flow que avisa a n8n al publicar, para lanzar ese rebuild automáticamente mediante el webhook del hosting.

---

Parte de [Paddock Daily](../README.md) · Desarrollado por **Francisco Javier Rodríguez Martín** ([@Froddes](https://github.com/Froddes))
