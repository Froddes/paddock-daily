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

export function getCategoryCoverUrl(slug = '') {
  const key = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const image = IMAGE_BY_KEY[key] || 'generic';
  return `/covers/${image}.webp`;
}
