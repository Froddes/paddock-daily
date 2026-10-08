/**
 * Orden de las categorías, compartido por el navbar, el rail "Todo el
 * paddock" de la home y las categorías del footer — así los tres siempre
 * coinciden y solo hay un sitio donde tocar si el orden cambia.
 *
 * Orden fijo del menú principal, pedido por el redactor. Se hace matching
 * por nombre (no por slug) para no depender de cómo esté configurado cada
 * slug en Directus. Cualquier categoría que exista pero no esté en esta
 * lista (Indycar, WRC, NASCAR, MotoGP, GT suelto, o categorías nuevas que
 * se creen más adelante) va detrás, en el orden en que venga de Directus
 * (alfabético) — que es también lo que cae en el desplegable "Otros" del
 * navbar.
 */
export const MAIN_CATEGORY_ORDER = ['Fórmula 1', 'WEC', 'GT World Challenge', 'IMSA', 'DTM'];

const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u', ñ: 'n' };
const normalize = (s) => (s || '').toLowerCase().trim().replace(/[áéíóúàèìòùñ]/g, (c) => ACCENTS[c] || c);

// { main, others }: "main" en el orden fijo del navbar, "others" el resto.
export function splitCategoriesLikeNav(categories = []) {
  const main = MAIN_CATEGORY_ORDER
    .map((name) => categories.find((c) => normalize(c.name) === normalize(name)))
    .filter(Boolean);
  const others = categories.filter((c) => !main.some((m) => m.id === c.id));
  return { main, others };
}

// Todas las categorías en el mismo orden que el navbar: primero las
// principales, después las de "Otros".
export function sortCategoriesLikeNav(categories = []) {
  const { main, others } = splitCategoriesLikeNav(categories);
  return [...main, ...others];
}
