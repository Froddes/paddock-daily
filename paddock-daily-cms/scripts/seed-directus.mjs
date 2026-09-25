/**
 * Carga contenido de prueba en Directus vía su API REST.
 *
 * Reutiliza el mismo contenido que ya está en los mockups (search.js,
 * opinion-listado.html, sobre-nosotros.html) para que lo que veas en
 * Directus coincida con lo que ya tienes maquetado.
 *
 * Es idempotente: si vuelves a ejecutarlo, busca por "slug" antes de
 * crear y reutiliza lo que ya exista en vez de duplicarlo.
 *
 * Uso (desde la raíz del proyecto, con Directus ya levantado):
 *   node scripts/seed-directus.mjs
 * o
 *   npm run seed
 *
 * Lee PUBLIC_URL, ADMIN_EMAIL y ADMIN_PASSWORD de tu .env.
 */

import { readFileSync } from 'node:fs';

// --- Carga manual del .env (sin dependencias externas) ---
function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const BASE_URL = (env.PUBLIC_URL || 'http://localhost:8055').replace(/\/$/, '');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

let token;

async function directus(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}

async function login() {
  const data = await directus('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
  });
  token = data.access_token;
}

// Busca por slug; si existe, ACTUALIZA ese registro con el resto de campos
// (para poder corregir contenido con solo volver a lanzar el script); si no
// existe, lo crea. Devuelve el id en ambos casos.
async function upsertBySlug(collection, item, slugField = 'slug') {
  const existing = await directus(
    `/items/${collection}?filter[${slugField}][_eq]=${encodeURIComponent(item[slugField])}&limit=1`
  );
  if (existing.length > 0) {
    await directus(`/items/${collection}/${existing[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    });
    console.log(`  ↻ ${collection}/${item[slugField]} ya existía, actualizado`);
    return existing[0].id;
  }
  const created = await directus(`/items/${collection}`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
  console.log(`  + ${collection}/${item[slugField]} creado`);
  return created.id;
}

// --- Datos ---

const CATEGORIES = [
  { name: 'Fórmula 1', slug: 'f1', description: 'La cúspide del automovilismo, con 20 pilotos y diez equipos compitiendo por el título de pilotos y constructores.' },
  { name: 'WEC', slug: 'wec', description: 'El Mundial de Resistencia FIA, con Hypercars, LMP2 y GT compitiendo en carreras de larga duración como Le Mans.' },
  { name: 'MotoGP', slug: 'motogp', description: 'La categoría reina del motociclismo de velocidad.' },
  { name: 'GT World Challenge', slug: 'gt-world-challenge', description: 'Competición internacional de GT con equipos privados y de fábrica.' },
  { name: 'DTM', slug: 'dtm', description: 'El campeonato de turismos más seguido de Europa.' },
  { name: 'IMSA', slug: 'imsa', description: 'El campeonato norteamericano de resistencia, con los prototipos GTP como categoría reina.' },
  { name: 'NASCAR', slug: 'nascar', description: 'La Copa NASCAR, la máxima categoría del stock car estadounidense.' },
];

const AUTHORS = [
  { name: 'Redacción Paddock Daily', slug: 'redaccion-paddock-daily', bio: 'El equipo de redacción de Paddock Daily, cubriendo la actualidad de todas las categorías del motor.', role: 'Redacción' },
  { name: 'Raúl Medina', slug: 'raul-medina', bio: 'Columnista de Fórmula 1 en Paddock Daily.', role: 'Columnista de Fórmula 1' },
  { name: 'Elena Cobos', slug: 'elena-cobos', bio: 'Columnista de IndyCar y GT en Paddock Daily.', role: 'Columnista de IndyCar y GT' },
];

const TAGS = ['Fórmula 1', 'Singapur', 'Verstappen', 'Clasificación', 'Red Bull', 'Ferrari', 'McLaren', 'MotoGP', 'Ducati', 'WEC', 'NASCAR', 'DTM', 'IMSA'].map(
  (name) => ({ name, slug: slugify(name) })
);

// title, categorySlug, dek, body, authorSlug, readingTime, featured, publishedDate
const ARTICLES = [
  {
    title: 'Verstappen firma la pole bajo las luces de Marina Bay por tres milésimas',
    categorySlug: 'f1',
    dek: 'El neerlandés supera a Norris en la última tanda de la Q3 en un final de infarto. Sainz completa la primera fila tras un sábado de banderas amarillas.',
    body: 'Max Verstappen ha vuelto a demostrar por qué sigue siendo la referencia en clasificación. En una Q3 marcada por el tráfico y dos banderas amarillas consecutivas, el neerlandés sacó una vuelta perfecta en su último intento para arrebatarle la pole a Lando Norris por apenas tres milésimas.\n\nEl británico, que había liderado las dos primeras tandas de la clasificación, no pudo mejorar su tiempo en el último giro tras encontrarse tráfico en el sector dos. Carlos Sainz completará la primera fila, su mejor resultado en clasificación desde su llegada al equipo.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 4,
    featured: true,
    publishedDate: '2026-09-13T21:00:00',
  },
  {
    title: 'Red Bull confirma la alineación de pilotos junior para los libres de Austin',
    categorySlug: 'f1',
    dek: 'Dos pilotos del programa júnior probarán el FP1 en Estados Unidos.',
    body: 'Red Bull ha confirmado que dos pilotos de su programa de jóvenes promesas subirán al monoplaza durante los primeros libres del Gran Premio de Estados Unidos, dentro de la cuota obligatoria de la FIA para pilotos con menos de dos años de experiencia.\n\nLa decisión se enmarca en la política habitual del equipo de rotar a sus pilotos junior en sesiones de bajo riesgo competitivo, aprovechando para recabar datos con neumáticos de distintas compuestos.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-09-10T10:00:00',
  },
  {
    title: 'Así queda el mundial de constructores tras el sábado en Singapur',
    categorySlug: 'f1',
    dek: 'McLaren amplía su ventaja sobre Ferrari a falta de seis carreras.',
    body: 'Tras la clasificación de Singapur, McLaren refuerza su posición al frente del campeonato de constructores gracias a la doble presencia en las dos primeras filas de la parrilla. Ferrari, tercero y quinto, pierde terreno de cara a la carrera del domingo.\n\nCon seis carreras por disputarse, la diferencia entre los dos primeros equipos se mantiene ajustada, aunque el trazado de Marina Bay —históricamente favorable a McLaren— podría decantar la balanza.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-09-13T18:30:00',
  },
  {
    title: 'Por qué Ferrari ha vuelto a ganar terreno en las curvas de baja velocidad',
    categorySlug: 'f1',
    dek: 'El nuevo paquete aerodinámico da sus frutos tres carreras después.',
    body: 'El paquete de actualizaciones que Ferrari introdujo hace tres grandes premios empieza a mostrar su efecto real en los datos de telemetría: la Scuderia ha recortado más de una décima en el sector de curvas lentas respecto al resto de rivales directos.\n\nEl equipo italiano atribuye la mejora a un nuevo reparto de carga aerodinámica entre el suelo y el difusor, sin penalizar la velocidad punta en recta.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 4,
    featured: false,
    publishedDate: '2026-09-06T12:00:00',
  },
  {
    title: 'McLaren presentará actualización de suelo en Austin, según fuentes del box',
    categorySlug: 'f1',
    dek: 'El equipo de Woking busca responder a la ofensiva de Red Bull.',
    body: 'McLaren tiene previsto introducir una revisión del suelo del monoplaza en el Gran Premio de Estados Unidos, según ha podido confirmar Paddock Daily con fuentes cercanas al equipo. La actualización llega en un momento en que Red Bull ha recortado distancia en las últimas citas.\n\nEl equipo no ha confirmado oficialmente el alcance de los cambios, aunque se espera que se centren en la zona de los pontones y el difusor trasero.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-09-04T09:00:00',
  },
  {
    title: 'Bagnaia recorta cuatro puntos al liderato tras un doblete en Motegi',
    categorySlug: 'motogp',
    dek: 'El italiano encadena su segunda victoria consecutiva a falta de cuatro citas.',
    body: 'Francesco Bagnaia se ha impuesto tanto en la sprint como en la carrera larga de Motegi, firmando su segundo doblete consecutivo y recortando cuatro puntos al líder del campeonato a falta de cuatro grandes premios para el final de temporada.\n\nEl italiano ha reconocido tras la carrera que el nuevo reglaje encontrado en los libres del viernes ha sido clave para adaptarse a las exigentes curvas del trazado japonés.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-09-07T13:00:00',
  },
  {
    title: 'Marc Márquez renueva con Ducati hasta el final de la década',
    categorySlug: 'motogp',
    dek: 'El acuerdo blinda al ocho veces campeón del mundo en el box oficial.',
    body: 'Ducati ha anunciado la renovación de Marc Márquez hasta 2030, extendiendo así una de las relaciones más exitosas del paddock en los últimos años. El acuerdo mantiene al piloto español en el equipo oficial junto a su actual compañero de box.\n\nLa marca de Borgo Panigale destaca en el comunicado la continuidad del proyecto deportivo como el motivo principal detrás de la renovación anticipada.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-08-30T11:00:00',
  },
  {
    title: 'Toyota se impone en las 6 Horas de Fuji ante una Ferrari en racha',
    categorySlug: 'wec',
    dek: 'La #8 gestiona los neumáticos en las últimas dos horas para sellar su cuarta victoria.',
    body: 'El Toyota GR010 Hybrid número 8 se ha impuesto en las 6 Horas de Fuji tras una gestión ejemplar de neumáticos en el último tramo de carrera, resistiendo el acoso de la Ferrari 499P que dominó buena parte del tramo intermedio.\n\nCon esta victoria, Toyota recorta distancia en el mundial de constructores a falta de dos citas para el final de la temporada.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 4,
    featured: false,
    publishedDate: '2026-08-28T16:00:00',
  },
  {
    title: 'Larson gana en Charlotte y entra directo a la ronda final de los Playoffs',
    categorySlug: 'nascar',
    dek: 'El piloto de Hendrick domina 210 de las 267 vueltas en una noche sin apenas banderas.',
    body: 'Kyle Larson ha dominado de principio a fin la cita de Charlotte, liderando 210 de las 267 vueltas de carrera y asegurándose así un puesto directo en la ronda final de los Playoffs de la Copa NASCAR.\n\nEl piloto del equipo Hendrick Motorsports reconoció tras la bandera a cuadros que el coche "no ha tenido rival" en las condiciones de pista de esta noche.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-08-31T23:00:00',
  },
  {
    title: 'DTM confirma dos nuevas fechas para la temporada 2027',
    categorySlug: 'dtm',
    dek: 'El calendario crece hasta las diez citas por primera vez en cinco años.',
    body: 'El DTM ha confirmado la incorporación de dos nuevos circuitos al calendario de 2027, ampliando la temporada a diez citas por primera vez desde 2022. La organización busca así recuperar presencia en mercados clave para los fabricantes participantes.\n\nEl calendario definitivo, con el orden completo de las diez fechas, se presentará durante el próximo trimestre.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 2,
    featured: false,
    publishedDate: '2026-09-01T10:00:00',
  },
  {
    title: 'IMSA presenta el nuevo reglamento técnico para los prototipos GTP',
    categorySlug: 'imsa',
    dek: 'Los cambios buscan igualar las prestaciones entre fabricantes de cara a 2027.',
    body: 'IMSA ha presentado el nuevo marco técnico que regirá la categoría GTP a partir de 2027, con ajustes en el sistema de balance de rendimiento y nuevas restricciones aerodinámicas comunes a todos los fabricantes.\n\nLa organización asegura que el objetivo es reducir la brecha de prestaciones que se ha abierto entre algunos fabricantes durante la temporada actual.',
    authorSlug: 'redaccion-paddock-daily',
    readingTime: 3,
    featured: false,
    publishedDate: '2026-08-25T09:00:00',
  },
];

const OPINION_COLUMNS = [
  {
    title: 'Verstappen no está ganando campeonatos: está redefiniendo el error aceptable',
    categorySlug: 'f1',
    dek: 'Tres milésimas en Singapur no son una anécdota estadística. Son la prueba de hasta dónde ha desplazado el neerlandés el límite de lo que la parrilla considera un margen de error tolerable.',
    body: 'Tres milésimas en Singapur no son una anécdota estadística. Son la prueba de hasta dónde ha desplazado el neerlandés el límite de lo que la parrilla considera un margen de error tolerable.\n\nCuando un piloto convierte sistemáticamente el margen mínimo en ventaja decisiva, deja de ser cuestión de suerte para convertirse en un rasgo de carácter competitivo que el resto de la parrilla tiene que asumir como referencia.',
    authorSlug: 'raul-medina',
    publishedDate: '2026-09-12T08:00:00',
  },
  {
    title: 'El reglamento de 2027 no resolverá el problema que dice resolver',
    categorySlug: 'f1',
    dek: 'Reducir el peso de los monoplazas no basta si la aerodinámica sigue penalizando a quien va detrás.',
    body: 'Reducir el peso de los monoplazas no basta si la aerodinámica sigue penalizando a quien va detrás. El nuevo reglamento ataca síntomas, no la causa de fondo del problema de las adelantamientos en la Fórmula 1 actual.\n\nMientras el aire sucio generado por el coche de delante siga siendo tan determinante, cualquier ajuste de peso será, como mucho, un parche cosmético.',
    authorSlug: 'raul-medina',
    publishedDate: '2026-09-08T08:00:00',
  },
  {
    title: 'Lo que la IndyCar puede enseñarle a la F1 sobre parrillas invertidas',
    categorySlug: 'f1',
    dek: 'Un formato que en Europa se mira con recelo lleva una década demostrando que puede convivir con la meritocracia.',
    body: 'Un formato que en Europa se mira con recelo lleva una década demostrando que puede convivir con la meritocracia. La IndyCar ha experimentado con parrillas invertidas parciales sin que eso haya devaluado el mérito deportivo de sus campeones.\n\nLa clave está en aplicarlo solo a un tramo de la parrilla y en carreras concretas del calendario, no como norma generalizada.',
    authorSlug: 'elena-cobos',
    publishedDate: '2026-09-03T08:00:00',
  },
  {
    title: 'Márquez y la pregunta que Ducati llevaba tres años evitando',
    categorySlug: 'motogp',
    dek: 'La renovación hasta 2030 no cierra el debate sobre el reparto de material entre los dos pilotos del box oficial.',
    body: 'La renovación hasta 2030 no cierra el debate sobre el reparto de material entre los dos pilotos del box oficial. Ducati ha resuelto la incertidumbre contractual, pero no la tensión estructural que arrastra desde hace tres temporadas.\n\nMientras ambos pilotos seguirán compitiendo bajo el mismo techo, la pregunta de fondo —quién recibe las piezas nuevas antes— seguirá ahí en cada actualización de material.',
    authorSlug: 'raul-medina',
    publishedDate: '2026-08-30T08:00:00',
  },
  {
    title: 'Por qué el mundial de constructores importa más de lo que creemos',
    categorySlug: 'f1',
    dek: 'El foco mediático está en el título de pilotos, pero el dinero — y el futuro de cada equipo — se juega en el otro campeonato.',
    body: 'El foco mediático está en el título de pilotos, pero el dinero —y el futuro de cada equipo— se juega en el otro campeonato. El reparto del fondo de premios de la F1 depende directamente de la posición final en constructores, no en pilotos.\n\nPara los equipos de mitad de tabla, cada posición ganada en ese campeonato puede suponer varios millones de diferencia en el presupuesto de la temporada siguiente.',
    authorSlug: 'raul-medina',
    publishedDate: '2026-08-24T08:00:00',
  },
];

// --- Ejecución ---

async function main() {
  console.log(`Conectando a ${BASE_URL}...`);
  await login();
  console.log('Autenticado.\n');

  console.log('Categorías:');
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    categoryIds[cat.slug] = await upsertBySlug('categories', { ...cat, status: 'published' });
  }

  console.log('\nAutores:');
  const authorIds = {};
  for (const author of AUTHORS) {
    // authors no tiene slug en el modelo; usamos "name" como clave de deduplicado
    const { slug, ...payload } = author;
    const existing = await directus(`/items/authors?filter[name][_eq]=${encodeURIComponent(author.name)}&limit=1`);
    if (existing.length > 0) {
      await directus(`/items/authors/${existing[0].id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      console.log(`  ↻ authors/${author.name} ya existía, actualizado`);
      authorIds[author.slug] = existing[0].id;
    } else {
      const created = await directus('/items/authors', { method: 'POST', body: JSON.stringify(payload) });
      console.log(`  + authors/${author.name} creado`);
      authorIds[author.slug] = created.id;
    }
  }

  console.log('\nTags:');
  for (const tag of TAGS) {
    await upsertBySlug('tags', tag);
  }

  console.log('\nArtículos:');
  for (const art of ARTICLES) {
    const slug = slugify(art.title);
    await upsertBySlug('articles', {
      title: art.title,
      slug,
      dek: art.dek,
      body: art.body,
      category: categoryIds[art.categorySlug],
      author: authorIds[art.authorSlug],
      published_date: art.publishedDate,
      reading_time: art.readingTime,
      featured: art.featured,
      status: 'published',
    });
  }

  console.log('\nColumnas de opinión:');
  for (const col of OPINION_COLUMNS) {
    const slug = slugify(col.title);
    await upsertBySlug('opinion_columns', {
      title: col.title,
      slug,
      dek: col.dek,
      body: col.body,
      category: categoryIds[col.categorySlug],
      author: authorIds[col.authorSlug],
      published_date: col.publishedDate,
      status: 'published',
    });
  }

  console.log('\nListo. Contenido de prueba cargado en Directus.');
}

main().catch((err) => {
  console.error('\nError durante la carga:', err.message);
  process.exit(1);
});
