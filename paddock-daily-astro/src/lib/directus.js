/**
 * Cliente mínimo para la API REST de Directus. Todas las funciones se
 * llaman desde el frontmatter de páginas/componentes .astro, que se
 * ejecuta en build time (sitio estático) — no hay llamadas a Directus
 * desde el navegador del visitante.
 *
 * Construimos el filtro como objeto y lo mandamos con JSON.stringify en
 * el parámetro "filter" en vez de la notación de corchetes
 * (filter[category][slug][_eq]=f1) porque es más fiable y menos propensa
 * a errores de sintaxis silenciosos.
 */

const BASE_URL = (import.meta.env.PUBLIC_DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, '');

function buildQuery({ filter, fields, sort, limit } = {}) {
  const qs = new URLSearchParams();
  if (filter) qs.set('filter', JSON.stringify(filter));
  if (fields) qs.set('fields', fields.join(','));
  if (sort) qs.set('sort', sort);
  if (limit) qs.set('limit', String(limit));
  return qs.toString();
}

async function directusFetch(collection, params) {
  const query = buildQuery(params);
  const url = `${BASE_URL}/items/${collection}${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Directus /items/${collection} -> ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data;
}

const PUBLISHED = { status: { _eq: 'published' } };

// --- Categorías ---

export function getCategories() {
  return directusFetch('categories', {
    fields: ['id', 'name', 'slug', 'description'],
    sort: 'name',
  });
}

export async function getCategoryBySlug(slug) {
  const items = await directusFetch('categories', {
    filter: { slug: { _eq: slug } },
    fields: ['id', 'name', 'slug', 'description'],
    limit: 1,
  });
  return items[0] || null;
}

// Devuelve un mapa { [category_id]: count } de artículos publicados por
// categoría, vía el endpoint de agregación de Directus.
export async function getArticleCountsByCategory() {
  const qs = new URLSearchParams();
  qs.set('aggregate[count]', 'id');
  qs.set('groupBy[]', 'category');
  qs.set('filter', JSON.stringify(PUBLISHED));
  const res = await fetch(`${BASE_URL}/items/articles?${qs.toString()}`);
  if (!res.ok) return {};
  const json = await res.json();
  const map = {};
  for (const row of json.data || []) {
    if (row.category != null) map[row.category] = Number(row.count?.id ?? 0);
  }
  return map;
}

// --- Autores ---

export function getAuthors() {
  return directusFetch('authors', {
    fields: ['id', 'name', 'bio', 'role'],
    sort: 'name',
  });
}

// --- Artículos ---

const ARTICLE_FIELDS = [
  'id', 'title', 'slug', 'dek', 'body', 'reading_time', 'featured',
  'published_date', 'status',
  'category.id', 'category.name', 'category.slug',
  'author.id', 'author.name', 'author.role',
];

export function getArticles({ categorySlug, limit, featured, excludeSlug } = {}) {
  const filter = { ...PUBLISHED };
  if (categorySlug) filter.category = { slug: { _eq: categorySlug } };
  if (featured !== undefined) filter.featured = { _eq: featured };
  if (excludeSlug) filter.slug = { _neq: excludeSlug };
  return directusFetch('articles', {
    filter,
    fields: ARTICLE_FIELDS,
    sort: '-published_date',
    limit,
  });
}

export async function getArticleBySlug(slug) {
  const items = await directusFetch('articles', {
    filter: { ...PUBLISHED, slug: { _eq: slug } },
    fields: ARTICLE_FIELDS,
    limit: 1,
  });
  return items[0] || null;
}

// --- Columnas de opinión ---

const OPINION_FIELDS = [
  'id', 'title', 'slug', 'dek', 'body', 'published_date', 'status',
  'category.id', 'category.name', 'category.slug',
  'author.id', 'author.name', 'author.role', 'author.bio',
];

export function getOpinionColumns({ limit, categorySlug, excludeSlug } = {}) {
  const filter = { ...PUBLISHED };
  if (categorySlug) filter.category = { slug: { _eq: categorySlug } };
  if (excludeSlug) filter.slug = { _neq: excludeSlug };
  return directusFetch('opinion_columns', {
    filter,
    fields: OPINION_FIELDS,
    sort: '-published_date',
    limit,
  });
}

export async function getOpinionColumnBySlug(slug) {
  const items = await directusFetch('opinion_columns', {
    filter: { ...PUBLISHED, slug: { _eq: slug } },
    fields: OPINION_FIELDS,
    limit: 1,
  });
  return items[0] || null;
}

// --- Formato de fechas ---

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(isoString) {
  if (!isoString) return '';
  return DATE_FORMATTER.format(new Date(isoString));
}

// Aproximación "hace X" calculada contra el momento del build (para un
// sitio estático no hay forma de que sea exacta en todo momento; se
// recalcula en cada rebuild, que es cuando de verdad importa que sea
// fresca — justo después de publicar algo nuevo).
export function timeAgo(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return formatDate(isoString);
}
