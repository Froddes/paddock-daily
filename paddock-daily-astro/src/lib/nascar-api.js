/**
 * Cliente para la API pública de ESPN (no oficial de NASCAR, pero es la
 * misma que usa espn.com/nascar y no requiere key). Igual que con MotoGP:
 * no es un contrato estable ni documentado oficialmente, puede cambiar
 * sin aviso. Si deja de funcionar, se quita este widget.
 *
 * Alcance limitado a propósito: esta API no expone horarios de sesión
 * (práctica/clasificación) ni resultados de carrera con detalle, así que
 * aquí solo se muestra la próxima carrera y la clasificación de pilotos.
 */

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard';
const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/racing/nascar-premier/standings';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NASCAR API ${url} -> ${res.status}`);
  return res.json();
}

async function getNextRace() {
  const json = await fetchJson(SCOREBOARD_URL);
  return json?.events?.[0] || null;
}

async function getDriverStandings(limit) {
  const json = await fetchJson(STANDINGS_URL);
  const entries = json?.children?.[0]?.standings?.entries || [];
  const rows = entries.map((entry) => {
    const rank = entry.stats?.find((s) => s.type === 'rank')?.displayValue || '';
    const points = entry.stats?.find((s) => s.type === 'points')?.displayValue || '';
    return { position: rank, name: entry.athlete?.displayName || '', points };
  });
  return limit ? rows.slice(0, limit) : rows;
}

function renderStandingsList(ul, rows) {
  if (!rows.length) {
    ul.innerHTML = '<li class="rc-status">Sin datos todavía.</li>';
    return;
  }
  ul.innerHTML = rows.map((row) => `
    <li>
      <span class="pos">${row.position}</span>
      <span class="driver">${row.name}</span>
      <span class="points">${row.points} pts</span>
    </li>
  `).join('');
}

function renderStandingsTable(tbody, rows) {
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="rc-status">Sin datos todavía.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="pos">${row.position}</td>
      <td class="driver"><strong>${row.name}</strong></td>
      <td class="points">${row.points} pts</td>
    </tr>
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

  // Próxima carrera y clasificación se piden y se pintan cada una por su
  // cuenta, sin esperarse entre sí.
  const racePromise = getNextRace().then((race) => {
    if (!race) {
      nameEl.textContent = 'Temporada sin próxima carrera programada';
      dateEl.textContent = '';
      return;
    }
    const comp = race.competitions?.[0];
    nameEl.textContent = race.name.replace(/^NASCAR Cup Series at /, '');
    flagEl.textContent = '🏁';
    dateEl.textContent = comp?.status?.type?.shortDetail || '';
    if (metaEl) metaEl.textContent = 'NASCAR Cup Series';
    liveEl.hidden = comp?.status?.type?.state !== 'in';

    const raceDate = new Date(race.date);
    if (raceDate.getTime() > Date.now()) {
      tickCountdown(root, raceDate);
    }
  }).catch(() => {
    nameEl.textContent = 'No se ha podido cargar RaceCenter';
    dateEl.textContent = 'Inténtalo de nuevo más tarde';
  });

  const standingsPromise = getDriverStandings(5)
    .then((standings) => renderStandingsList(driversEl, standings))
    .catch(() => { driversEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de NASCAR.</li>'; });

  await Promise.allSettled([racePromise, standingsPromise]);
}

// --- Página de resultados completos ---

export async function initRaceCenterResultsPage(root) {
  if (!root) return;
  const driversBody = root.querySelector('[data-rc-drivers-body]');

  try {
    const standings = await getDriverStandings();
    if (driversBody) renderStandingsTable(driversBody, standings);
  } catch (err) {
    if (driversBody) driversBody.innerHTML = '<tr><td colspan="3" class="rc-status">No se ha podido conectar con la API de NASCAR.</td></tr>';
  }
}
