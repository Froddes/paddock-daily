// Markdown compartido para el cuerpo de artículos y columnas de opinión.
//
// Único cambio respecto al renderer por defecto de `marked`: todos los
// enlaces se abren en pestaña nueva (target="_blank") con
// rel="noopener noreferrer" — así un enlace que pega el redactor en el
// cuerpo (fuente, tuit, lo que sea) no saca al lector del artículo.
//
// Nota: en vez de sobrescribir el renderer de `marked` (su API de
// `this.parser.parseInline` dentro del renderer es frágil entre
// versiones, ver https://github.com/markedjs/marked/issues — varía
// según cómo se instancie `Marked`), se deja el HTML tal cual lo genera
// marked y se le añaden los atributos a los <a> ya generados. Más simple
// y no depende de detalles internos de la librería.
import { marked } from 'marked';

export function renderMarkdown(text) {
  const html = marked.parse(text || '');
  return html.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=');
}
