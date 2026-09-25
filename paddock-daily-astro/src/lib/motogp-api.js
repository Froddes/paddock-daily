/**
 * Cliente para la API interna (no oficial) de motogp.com. No es una API
 * pública documentada por Dorna/MotoGP — es el backend que usa su propia
 * web, reconstruido por la comunidad (https://github.com/robschmitt/MotoGP-API).
 * No requiere key, pero puede cambiar o dejar de funcionar sin aviso al no
 * ser un contrato estable. Si eso pasa, se quita este widget y listo.
 *
 * A diferencia de F1 (Jolpica), esta API no da horarios de sesión por
 * evento de forma fiable ni clasificación de equipos/constructores, así
 * que el alcance aquí es más limitado a propósito: próximo GP, cuenta
 * atrás al fin de semana, clasificación de pilotos y calendario.
 */

const BASE = 'https://api.motogp.pulselive.com/motogp/v1';

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`MotoGP API ${path} -> ${res.status}`);
  return res.json();
}

async function getCurrentSeason() {
  const seasons = await fetchJson('/results/seasons');
  return seasons.find((s) => s.current) || seasons[0];
}

async function getMotoGPCategoryUuid(seasonUuid) {
  const categories = await fetchJson(`/results/categories?seasonUuid=${seasonUuid}`);
  const motogp = categories.find((c) => /motogp/i.test(c.name));
  return motogp?.id || categories[0]?.id;
}

async function getSeasonEvents(seasonUuid) {
  const events = await fetchJson(`/results/events?seasonUuid=${seasonUuid}`);
  return [...events].sort((a, b) => a.date_start.localeCompare(b.date_start));
}

async function getNextEvent(seasonUuid) {
  const events = await fetchJson(`/results/events?seasonUuid=${seasonUuid}&isFinished=false`);
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start));
  return sorted[0] || null;
}

async function getStandings(seasonUuid, categoryUuid, limit) {
  const rows = await fetchJson(`/results/standings?seasonUuid=${seasonUuid}&categoryUuid=${categoryUuid}`);
  return limit ? rows.slice(0, limit) : rows;
}

function flagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return '🏁';
  return String.fromCodePoint(
    ...[...isoCode.toLowerCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 97))
  );
}

function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
}

const DATE_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
const DATE_FMT_SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

function dateRangeLabel(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  return `${DATE_FMT_SHORT.format(start)} – ${DATE_FMT.format(end)}`;
}

function renderStandingsList(ul, rows) {
  if (!rows.length) {
    ul.innerHTML = '<li class="rc-status">Sin datos todavía.</li>';
    return;
  }
  ul.innerHTML = rows.map((row) => `
    <li>
      <span class="pos">${row.position}</span>
      <span class="driver">${row.rider?.full_name || ''}</span>
      <span class="points">${row.points} pts</span>
    </li>
  `).join('');
}

function tickCountdown(root, target) {
  const dEl = root.querySelector('[data-rc-d]');
  const hEl = root.querySelector('[data-rc-h]');
  const mEl = root.querySelector('[data-rc-m]');
  const sEl = root.querySelector('[data-rc-s]');
  const box = root.querySelector('[data-rc-countdown]');
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  function update() {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const totalSeconds = Math.floor(diff / 1000);
    dEl.textContent = pad(Math.floor(totalSeconds / 86400));
    hEl.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
    mEl.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
    sEl.textContent = pad(totalSeconds % 60);
  }

  update();
  const timer = setInterval(update, 1000);
  document.addEventListener('astro:before-preparation', () => clearInterval(timer), { once: true });
}

// --- Widget del aside de categoría ---

export async function initRaceCenterCard(root) {
  if (!root) return;
  const nameEl = root.querySelector('[data-rc-name]');
  const dateEl = root.querySelector('[data-rc-date]');
  const metaEl = root.querySelector('[data-rc-meta]');
  const flagEl = root.querySelector('[data-rc-flag]');
  const liveEl = root.querySelector('[data-rc-live]');
  const driversEl = root.querySelector('[data-rc-standings-drivers]');

  try {
    const season = await getCurrentSeason();
    const [event, categoryUuid] = await Promise.all([
      getNextEvent(season.id),
      getMotoGPCategoryUuid(season.id),
    ]);
    const standings = await getStandings(season.id, categoryUuid, 5);

    if (event) {
      nameEl.textContent = toTitleCase(event.name);
      flagEl.textContent = flagEmoji(event.country?.iso);
      dateEl.textContent = dateRangeLabel(event.date_start, event.date_end);
      if (metaEl) metaEl.textContent = event.circuit?.name || '';
      liveEl.hidden = event.status !== 'ONGOING';

      const weekendStart = new Date(`${event.date_start}T00:00:00`);
      if (weekendStart.getTime() > Date.now()) {
        tickCountdown(root, weekendStart);
      }
    } else {
      nameEl.textContent = 'Temporada sin próximo GP programado';
      dateEl.textContent = '';
    }

    renderStandingsList(driversEl, standings);
  } catch (err) {
    nameEl.textContent = 'No se ha podido cargar RaceCenter';
    dateEl.textContent = 'Inténtalo de nuevo más tarde';
    driversEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de MotoGP.</li>';
  }
}

// --- Página de resultados completos ---

function renderStandingsTable(tbody, rows) {
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="pos">${row.position}</td>
      <td class="driver"><strong>${row.rider?.full_name || ''}</strong><span>${row.team?.name || ''}</span></td>
      <td class="muted">${row.constructor?.name || ''}</td>
      <td class="points">${row.points} pts</td>
    </tr>
  `).join('');
}

function renderCalendar(list, events) {
  const now = Date.now();
  list.innerHTML = events.map((e) => {
    const isNext = e.status === 'NOT-STARTED' && new Date(`${e.date_start}T00:00:00`).getTime() > now
      && events.filter((ev) => ev.status === 'NOT-STARTED').every((ev) => ev.date_start >= e.date_start);
    const isDone = e.status === 'FINISHED';
    return `
      <li class="calendar-row${isNext ? ' is-next' : ''}${isDone ? ' is-done' : ''}">
        <span class="name">${flagEmoji(e.country?.iso)} ${toTitleCase(e.name)}</span>
        <span class="loc">${e.circuit?.place || ''}</span>
        <span class="date">${dateRangeLabel(e.date_start, e.date_end)}</span>
        ${isNext ? '<span class="next-tag">Próxima</span>' : ''}
      </li>
    `;
  }).join('');
}

// Delegación de clic para el patrón de pestañas data-tabs/data-tab/data-panel.
function wireTabs(root) {
  root.querySelectorAll('[data-tabs]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      const target = btn.dataset.tab;
      const scope = group.closest('[data-tabs-scope]') || root;
      scope.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== target;
      });
    });
  });
}

export async function initRaceCenterResultsPage(root) {
  if (!root) return;
  wireTabs(root);

  const driversBody = root.querySelector('[data-rc-drivers-body]');
  const calendarEl = root.querySelector('[data-rc-calendar]');

  try {
    const season = await getCurrentSeason();
    const categoryUuid = await getMotoGPCategoryUuid(season.id);
    const [standings, events] = await Promise.all([
      getStandings(season.id, categoryUuid),
      getSeasonEvents(season.id),
    ]);

    if (driversBody) renderStandingsTable(driversBody, standings);
    if (calendarEl) renderCalendar(calendarEl, events.filter((e) => !e.test));
  } catch (err) {
    if (driversBody) driversBody.innerHTML = '<tr><td colspan="4" class="rc-status">No se ha podido conectar con la API de MotoGP.</td></tr>';
    if (calendarEl) calendarEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de MotoGP.</li>';
  }
}
