// Configuración de anuncios (Google AdSense), toda por variables de entorno
// para poder activarlos sin tocar código — y desactivados por defecto.
//
// Hay DOS interruptores, a propósito:
//   PUBLIC_ADSENSE_CLIENT   → "ca-pub-XXXXXXXXXXXXXXXX". Solo con esto se
//                             añade la etiqueta <meta name="google-adsense-account">
//                             (sirve para verificar el sitio al solicitar el
//                             alta) y se genera /ads.txt. NO carga ningún
//                             script de Google ni pone cookies.
//   PUBLIC_ADS_ENABLED=true → carga el script de AdSense y pinta los huecos.
//                             Activar solo cuando AdSense haya aprobado el
//                             sitio Y el CMP certificado (Privacidad y
//                             mensajes de AdSense) esté publicado.
//   PUBLIC_ADSENSE_SLOT_ARTICLE_MID / _ARTICLE_END / _SIDEBAR / _HOME_MID
//                           → id de cada bloque de anuncios (data-ad-slot)
//                             creado en AdSense. Sin id, ese hueco no se pinta.
const env = import.meta.env;

export const ADSENSE_CLIENT = (env.PUBLIC_ADSENSE_CLIENT || '').trim();
export const ADS_ENABLED = Boolean(ADSENSE_CLIENT) && String(env.PUBLIC_ADS_ENABLED).toLowerCase() === 'true';

// Vista previa de huecos SOLO en `npm run dev` (import.meta.env.DEV es false en
// `npm run build`, así que nunca llega a producción). Pinta cajas de colores
// donde irán los anuncios. Para ocultarlas en dev: PUBLIC_ADS_PREVIEW=false.
export const ADS_PREVIEW = Boolean(env.DEV) && String(env.PUBLIC_ADS_PREVIEW).toLowerCase() !== 'false';

export const AD_SLOTS = {
  articleMid: (env.PUBLIC_ADSENSE_SLOT_ARTICLE_MID || '').trim(),
  articleEnd: (env.PUBLIC_ADSENSE_SLOT_ARTICLE_END || '').trim(),
  // Lateral de categorías y de la portada (se reutiliza el mismo bloque).
  sidebar: (env.PUBLIC_ADSENSE_SLOT_SIDEBAR || '').trim(),
  // Banner horizontal en la portada, entre "Portada" y "Última hora".
  homeMid: (env.PUBLIC_ADSENSE_SLOT_HOME_MID || '').trim(),
};

// Parte el HTML de un artículo en dos justo después del párrafo nº `afterParagraph`,
// para colocar un anuncio entre ambas mitades. Si el texto es corto (el anuncio
// quedaría pegado al final), devuelve el HTML entero y la segunda mitad vacía.
export function splitArticleHtml(html = '', afterParagraph = 3) {
  const closing = '</p>';
  let idx = -1;
  let count = 0;
  while (count < afterParagraph) {
    idx = html.indexOf(closing, idx + 1);
    if (idx === -1) return [html, ''];
    count += 1;
  }
  const cut = idx + closing.length;
  const remaining = (html.slice(cut).match(/<\/p>/g) || []).length;
  if (remaining < 2) return [html, ''];
  return [html.slice(0, cut), html.slice(cut)];
}
