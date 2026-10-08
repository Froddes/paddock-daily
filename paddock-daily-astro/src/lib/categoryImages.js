import { getAssetUrl } from './directus.js';

// Mapeo slug de categoría → fichero en public/covers/. Compartido entre
// CategoryCover.astro (banner de cabecera) y cualquier otro sitio que
// necesite la misma foto editorial (p. ej. las tarjetas de "Todo el
// paddock" en home). Categorías sin imagen propia caen en 'generic'.
const IMAGE_BY_KEY = {
  f1: 'f1',
  motogp: 'motogp',
  wec: 'wec',
  dtm: 'dtm',
  imsa: 'imsa',
  nascar: 'nascar',
  gtworldchallenge: 'gtwc',
  gtwc: 'gtwc',
};

// `banner` es el id del archivo subido en Directus (campo categories.banner);
// si existe tiene prioridad sobre la imagen local de public/covers/.
export function getCategoryCoverUrl(slug = '', banner = null, width = 1600) {
  if (banner) return getAssetUrl(banner, { width });
  const key = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const image = IMAGE_BY_KEY[key] || 'generic';
  return `/covers/${image}.webp`;
}
