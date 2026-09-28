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
  // Pagefind genera /pagefind/pagefind.js DESPUÉS de "astro build" (ver el
  // script "build" en package.json), así que ese archivo no existe todavía
  // cuando Rollup empaqueta el sitio. Lo marcamos como externo para que no
  // intente resolverlo en build time y lo cargue en el navegador tal cual,
  // como una URL absoluta normal, cuando ya exista en producción.
  vite: {
    build: {
      rollupOptions: {
        external: ['/pagefind/pagefind.js'],
      },
    },
  },
});
