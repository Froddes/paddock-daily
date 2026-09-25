# 🏁 Paddock Daily

**Medio digital de motorsport** — Fórmula 1, MotoGP, WEC, DTM, IMSA, NASCAR y GT World Challenge. Noticias, columnas de opinión firmadas y datos de carrera en vivo, en un sitio 100% estático y rápido.

![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![Directus](https://img.shields.io/badge/Directus-CMS-263238?logo=directus&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-privado-lightgrey)

---

## Sobre el proyecto

Paddock Daily es un medio editorial de motor construido como un sitio **server-side generated (SSG)**, con todo el contenido gestionado desde un CMS headless propio. Nada de WordPress ni de plataformas de terceros: el frontend, el modelo de contenido, la automatización editorial y los datos de carrera en vivo están montados a medida, pieza a pieza.

El proyecto está pensado para funcionar con un único redactor gestionando el día a día del contenido, con el máximo de tareas repetitivas automatizadas (fecha de publicación, tiempo de lectura, generación de slugs) para que la única fricción real sea escribir.

## Arquitectura

```
┌─────────────────────┐        REST API        ┌───────────────────────┐
│   Astro (SSG)        │ ◄────────────────────► │   Directus (headless)  │
│   paddock-daily-astro │      build time         │   paddock-daily-cms    │
└─────────┬────────────┘                         └───────────┬────────────┘
          │                                                    │
          │  fetch en el navegador                             │ Flows (Event Hooks)
          │  (F1 y NASCAR en vivo)                              │ auto-fecha · reading time · slugs
          ▼                                                    ▼
┌─────────────────────┐                         ┌───────────────────────┐
│  Jolpica-F1 / ESPN    │                         │      PostgreSQL         │
│  APIs públicas         │                         │   (contenido + media)    │
└─────────────────────┘                         └───────────────────────┘
```

El contenido editorial se genera en **build time** (SSG clásico: rápido, indexable, sin servidor que mantener). Los datos de carrera del widget **RaceCenter**, en cambio, se piden **en el navegador del visitante** contra APIs públicas de terceros, para que el calendario, la cuenta atrás y la clasificación estén siempre al día sin depender de cuándo se hizo el último build.

## Estructura del repositorio

```
Web/
├── paddock-daily-astro/     → Frontend público (Astro)
│   ├── src/
│   │   ├── components/        → StoryCard, OpinionCard, RaceCenterCard, ThumbPlaceholder...
│   │   ├── layouts/            → Layout.astro (tema claro/oscuro, header/footer)
│   │   ├── lib/                  → directus.js, f1-api.js, nascar-api.js
│   │   └── pages/                → home, categorías, artículos, opinión, resultados en vivo...
│   └── README.md
│
└── paddock-daily-cms/       → Backend (Directus + Postgres, Docker Compose)
    └── DIRECTUS-COLLECTIONS.md → modelo de datos, roles, dashboard y flows documentados
```

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | [Astro](https://astro.build) (SSG), CSS puro con custom properties, Markdown → HTML con `marked` |
| CMS | [Directus](https://directus.io) (headless, self-hosted) |
| Base de datos | PostgreSQL, vía Docker Compose |
| Automatización editorial | Directus Flows (Event Hooks + Run Script) |
| Datos de carrera en vivo | [Jolpica-F1](https://api.jolpi.ca) (F1) y la API pública de ESPN (NASCAR) — sin backend propio, fetch directo desde el cliente |
| Tipografía | Space Grotesk + Inter + Source Serif 4 (Google Fonts) |

## Funcionalidades

- **Modelo de contenido completo**: artículos, columnas de opinión, categorías, autores y tags, con relaciones M2O/M2M gestionadas desde Directus.
- **Automatización editorial**: fecha de publicación, tiempo de lectura estimado y slugs se generan solos al publicar — cero pasos manuales repetitivos.
- **Dashboard de redacción**: panel de Insights en Directus con métricas de borradores, publicados y actividad reciente.
- **Tema claro/oscuro** persistente, con la sección de Opinión en oscuro fijo por diseño editorial.
- **Búsqueda** en cliente sobre el contenido real embebido en el build.
- **RaceCenter** — próxima carrera, cuenta atrás en vivo, sesiones del fin de semana, clasificación y resultados, sin ninguna dependencia de Directus (ver más abajo).
- **Portadas generativas por categoría**: motivos SVG propios para F1, MotoGP, WEC, DTM, IMSA, NASCAR y GT World Challenge, a la espera de fotografía editorial real.

## RaceCenter — datos en vivo

El widget de la barra lateral en las categorías de **F1** y **NASCAR**, y sus páginas de resultados completos, no usan ningún dato editado a mano: todo se pide en tiempo real desde el navegador del visitante.

- **F1** → [Jolpica-F1](https://api.jolpi.ca), sucesora mantenida de la antigua Ergast API. Sin API key. Cobertura completa: calendario, sesiones de cada GP, clasificación de pilotos y constructores, resultados de la última carrera y vuelta rápida.
- **NASCAR** → API pública de ESPN. Sin API key. Cobertura más ajustada (próxima carrera y clasificación de pilotos), por las limitaciones de la propia API.

> MotoGP se evaluó pero se descartó: su API bloquea activamente las peticiones hechas desde fuera de motogp.com.

Ninguna de estas integraciones tiene contrato oficial ni SLA — son APIs públicas de terceros usadas de buena fe. Si alguna deja de responder, el widget correspondiente se retira sin que afecte al resto del sitio.

## Puesta en marcha

```bash
# 1. Backend (Directus + Postgres)
cd paddock-daily-cms
cp .env.example .env
docker compose up -d

# 2. Frontend (Astro)
cd ../paddock-daily-astro
npm install
cp .env.example .env
npm run dev          # http://localhost:4321
```

Cada carpeta tiene su propio README con más detalle.

## Roadmap

- [x] **Fase 0-1** — Maquetación HTML/CSS/JS
- [x] **Fase 2** — Migración a Astro + Directus, contenido real
- [x] **Fase 3** — Pulido de UI/UX, RaceCenter en vivo
- [ ] **Fase 4** — Pagefind, automatización de publicación (n8n → rebuild), newsletter real, SEO técnico (sitemap, JSON-LD)
- [ ] **Fase 5** — Fotografía editorial, anuncios (una vez haya tráfico)

---

Desarrollado por **Fran** ([@Froddes](https://github.com/Froddes)).
