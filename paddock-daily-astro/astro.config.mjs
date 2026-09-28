import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Sitio estático (SSG): todas las páginas se generan en build time a
  // partir de los datos de Directus. Para que un artículo nuevo aparezca
  // en producción hace falta un rebuild — el flow "Aviso a n8n al
  // publicar" (ver DIRECTUS-COLLECTIONS.md) es el punto de enganche
  // natural para disparar ese rebuild automáticamente el día que se
  // conecte (ej. n8n llama a un webhook de tu proveedor de hosting).
  site: 'https://paddock-daily.com',
  integrations: [sitemap()],
});
