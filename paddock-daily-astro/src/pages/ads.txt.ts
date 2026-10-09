// /ads.txt — lista pública de quién puede vender anuncios en este sitio.
// Se genera desde PUBLIC_ADSENSE_CLIENT ("ca-pub-123…" → "pub-123…").
// Mientras no haya ID, devuelve solo un comentario (no hay anuncios aún).
import { ADSENSE_CLIENT } from '../lib/ads.js';

export function GET() {
  const pub = ADSENSE_CLIENT.replace(/^ca-/, '');
  const body = pub
    ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
    : '# ads.txt de paddock-daily.com — sin vendedores autorizados todavía.\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
