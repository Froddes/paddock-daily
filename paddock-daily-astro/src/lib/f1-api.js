/**
 * Cliente para la API pública Jolpica-F1 (https://api.jolpi.ca/ergast/f1/),
 * sucesora compatible de la antigua Ergast API (cerrada a finales de 2024).
 * Gratuita, sin API key. Todo lo de esta página se pide desde el navegador
 * del visitante (no en build time) para que el widget y la página de
 * resultados estén siempre al día aunque el sitio sea estático — mismo
 * patrón que se usó en la landing de Pitwall.
 *
 * Deliberadamente sin nada editorial (valoraciones, crónicas, qué GP es
 * "el actual"...): eso vivía antes en Directus y se ha quitado a petición
 * expresa — todo lo que se ve aquí sale de la API.
 */

const BASE = 'https://api.jolpi.ca/ergast/f1';

// Países que aparecen en el calendario de F1 -> código ISO 3166-1 alpha-2,
// para generar el emoji de bandera (Jolpica solo da el nombre del país,
// no un código). Lista cerrada, se amplía si cambia el calendario.
const COUNTRY_TO_ISO = {
  'Bahrain': 'bh', 'Saudi Arabia': 'sa', 'Australia': 'au', 'Japan': 'jp',
  'China': 'cn', 'USA': 'us', 'United States': 'us', 'Italy': 'it',
  'Monaco': 'mc', 'Canada': 'ca', 'Spain': 'es', 'Austria': 'at',
  'UK': 'gb', 'United Kingdom': 'gb', 'Great Britain': 'gb',
  'Hungary': 'hu', 'Belgium': 'be', 'Netherlands': 'nl', 'Singapore': 'sg',
  'Azerbaijan': 'az', 'Mexico': 'mx', 'Brazil': 'br', 'Qatar': 'qa',
  'UAE': 'ae', 'United Arab Emirates': 'ae', 'Germany': 'de',
  'Portugal': 'pt', 'France': 'fr', 'Turkey': 'tr', 'Malaysia': 'my',
  'India': 'in', 'South Korea': 'kr', 'Korea': 'kr', 'Russia': 'ru',
};

function flagEmoji(countryName) {
  const code = COUNTRY_TO_ISO[countryName];
  if (!code) return '🏁';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 97)));
}

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Jolpica ${path} -> ${res.status}`);
  return res.json();
}

function getNextRace() {
  return fetchJson('/current/next.json').then(
    (json) => json?.MRData?.RaceTable?.Races?.[0] || null
  );
}

function getSeasonSchedule() {
  return fetchJson('/current.json?limit=40').then(
    (json) => json?.MRData?.RaceTable?.Races || []
  );
}

function getDriverStandings(limit) {
  return fetchJson('/current/driverStandings.json').then((json) => {
    const rows = json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    return limit ? rows.slice(0, limit) : rows;
  });
}

function getConstructorStandings(limit) {
  return fetchJson('/current/constructorStandings.json').then((json) => {
    const rows = json?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    return limit ? rows.slice(0, limit) : rows;
  });
}

function getLastRaceResults() {
  return fetchJson('/current/last/results.json').then(
    (json) => json?.MRData?.RaceTable?.Races?.[0] || null
  );
}

function getLastRaceQualifying() {
  return fetchJson('/current/last/qualifying.json').then(
    (json) => json?.MRData?.RaceTable?.Races?.[0] || null
  );
}

const DATE_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
const DATE_FMT_SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const TIME_FMT = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

function sessionDate(session) {
  if (!session?.date || !session?.time) return null;
  return new Date(`${session.date}T${session.time}`);
}

// Duración estimada de cada sesión, para saber si está "en directo" ahora
// mismo (Jolpica solo da la hora de inicio, no la de fin).
const SESSION_DURATIONS_MIN = {
  FirstPractice: 60, SecondPractice: 60, ThirdPractice: 60,
  SprintQualifying: 45, Sprint: 45, Qualifying: 60, Race: 150,
};

function sessionStatus(start, durationMin) {
  if (!start) return null;
  const now = Date.now();
  const end = start.getTime() + durationMin * 60000;
  if (now < start.getTime()) return 'upcoming';
  if (now <= end) return 'live';
  return 'done';
}

function buildSessionList(race) {
  const order = [
    ['FirstPractice', 'FP1'], ['SecondPractice', 'FP2'], ['ThirdPractice', 'FP3'],
    ['SprintQualifying', 'Clasificación sprint'], ['Sprint', 'Sprint'],
    ['Qualifying', 'Clasificación'],
  ];
  const list = [];
  for (const [key, label] of order) {
    const start = sessionDate(race[key]);
    if (!start) continue;
    list.push({ label, start, status: sessionStatus(start, SESSION_DURATIONS_MIN[key]) });
  }
  const raceStart = sessionDate({ date: race.date, time: race.time });
  if (raceStart) {
    list.push({ label: 'Carrera', start: raceStart, status: sessionStatus(raceStart, SESSION_DURATIONS_MIN.Race) });
  }
  return list;
}

function renderSessionList(ul, sessions) {
  if (!sessions.length) {
    ul.hidden = true;
    return;
  }
  ul.hidden = false;
  ul.innerHTML = sessions.map((s) => {
    if (s.status === 'live') {
      return `<li><span class="name">${s.label}</span><span class="status-live">En directo</span></li>`;
    }
    if (s.status === 'done') {
      return `<li><span class="name">${s.label}</span><span>Finalizada</span></li>`;
    }
    return `<li><span class="name">${s.label}</span><span>${TIME_FMT.format(s.start)}</span></li>`;
  }).join('');
}

function driverShortName(driver) {
  return `${driver.givenName.charAt(0)}. ${driver.familyName}`;
}

function renderDriverStandingsList(ul, rows) {
  if (!rows.length) {
    ul.innerHTML = '<li class="rc-status">Sin datos todavía.</li>';
    return;
  }
  ul.innerHTML = rows.map((row) => `
    <li>
      <span class="pos">${row.position}</span>
      <span class="driver">${driverShortName(row.Driver)}</span>
      <span class="points">${row.points} pts</span>
    </li>
  `).join('');
}

function renderConstructorStandingsList(ul, rows) {
  if (!rows.length) {
    ul.innerHTML = '<li class="rc-status">Sin datos todavía.</li>';
    return;
  }
  ul.innerHTML = rows.map((row) => `
    <li>
      <span class="pos">${row.position}</span>
      <span class="driver">${row.Constructor.name}</span>
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
  // Si el componente se desmonta (navegación de Astro con client-side
  // routing), evitamos que el intervalo siga corriendo en segundo plano.
  document.addEventListener('astro:before-preparation', () => clearInterval(timer), { once: true });
}

// Delegación de clic genérica para el patrón de pestañas
// data-tabs / data-tab / data-panel, ya usado en otras páginas del sitio.
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

// --- Widget del aside de categoría ---

export async function initRaceCenterCard(root) {
  if (!root) return;
  wireTabs(root);

  const nameEl = root.querySelector('[data-rc-name]');
  const dateEl = root.querySelector('[data-rc-date]');
  const metaEl = root.querySelector('[data-rc-meta]');
  const flagEl = root.querySelector('[data-rc-flag]');
  const liveEl = root.querySelector('[data-rc-live]');
  const sessionsEl = root.querySelector('[data-rc-sessions]');
  const driversEl = root.querySelector('[data-rc-standings-drivers]');
  const constructorsEl = root.querySelector('[data-rc-standings-constructors]');

  // Cada bloque se pide y se pinta por su cuenta en cuanto llega, en vez
  // de esperar con un único Promise.all a que respondan las cuatro
  // llamadas — así lo primero que carga se ve de inmediato en vez de que
  // todo el widget quede en "Cargando…" hasta la respuesta más lenta.
  let race = null;

  const racePromise = getNextRace().then((r) => {
    race = r;
    if (!r) {
      nameEl.textContent = 'Temporada sin próxima carrera programada';
      dateEl.textContent = '';
      return;
    }
    nameEl.textContent = r.raceName;
    flagEl.textContent = flagEmoji(r.Circuit?.Location?.country);
    const raceStart = sessionDate({ date: r.date, time: r.time });
    dateEl.textContent = raceStart ? DATE_FMT.format(raceStart) : '';

    const sessions = buildSessionList(r);
    renderSessionList(sessionsEl, sessions);
    liveEl.hidden = !sessions.some((s) => s.status === 'live');

    if (raceStart && raceStart.getTime() > Date.now()) {
      tickCountdown(root, raceStart);
    }
  }).catch(() => {
    nameEl.textContent = 'No se ha podido cargar RaceCenter';
    dateEl.textContent = 'Inténtalo de nuevo más tarde';
  });

  // El calendario completo solo hace falta para el "Ronda X/Y" — no debe
  // retrasar nada más, así que va suelto y se aplica cuando llegue.
  getSeasonSchedule().then((schedule) => {
    if (race && metaEl) {
      metaEl.textContent = `Ronda ${race.round}/${schedule.length} · ${race.Circuit?.circuitName || ''}`;
    }
  }).catch(() => {});

  const driversPromise = getDriverStandings(5)
    .then((rows) => renderDriverStandingsList(driversEl, rows))
    .catch(() => { driversEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de F1.</li>'; });

  const constructorsPromise = getConstructorStandings(5)
    .then((rows) => renderConstructorStandingsList(constructorsEl, rows))
    .catch(() => { if (constructorsEl) constructorsEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de F1.</li>'; });

  await Promise.allSettled([racePromise, driversPromise, constructorsPromise]);
}

// --- Página de resultados completos ---

function renderRaceResultTable(tbody, results) {
  tbody.innerHTML = results.map((row) => {
    const finished = row.status === 'Finished' || /^\+/.test(row.status);
    const resultLabel = finished ? (row.status === 'Finished' ? row.Time?.time || 'Finalizado' : row.status) : row.status;
    return `
      <tr>
        <td class="pos">${row.position}</td>
        <td class="driver"><strong>${row.Driver.givenName} ${row.Driver.familyName}</strong><span>${row.Constructor.name}</span></td>
        <td class="muted">${row.grid === '0' ? 'Pit lane' : row.grid}</td>
        <td class="muted">${resultLabel}</td>
        <td class="points">${row.points} pts</td>
      </tr>
    `;
  }).join('');
}

function renderFastestLap(box, results) {
  const fl = results.find((r) => r.FastestLap?.rank === '1');
  if (!fl) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `Vuelta rápida: <strong>${fl.Driver.givenName} ${fl.Driver.familyName}</strong> — ${fl.FastestLap.Time?.time || ''} (vuelta ${fl.FastestLap.lap})`;
}

function renderQualifyingTable(tbody, rows) {
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="pos">${row.position}</td>
      <td class="driver"><strong>${row.Driver.givenName} ${row.Driver.familyName}</strong><span>${row.Constructor.name}</span></td>
      <td class="muted">${row.Q1 || '—'}</td>
      <td class="muted">${row.Q2 || '—'}</td>
      <td class="muted">${row.Q3 || '—'}</td>
    </tr>
  `).join('');
}

function renderDriverStandingsTable(tbody, rows) {
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="pos">${row.position}</td>
      <td class="driver"><strong>${row.Driver.givenName} ${row.Driver.familyName}</strong><span>${row.Constructors?.[0]?.name || ''}</span></td>
      <td class="muted">${row.wins}</td>
      <td class="points">${row.points} pts</td>
    </tr>
  `).join('');
}

function renderConstructorStandingsTable(tbody, rows) {
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td class="pos">${row.position}</td>
      <td class="driver"><strong>${row.Constructor.name}</strong><span>${row.Constructor.nationality || ''}</span></td>
      <td class="muted">${row.wins}</td>
      <td class="points">${row.points} pts</td>
    </tr>
  `).join('');
}

function renderCalendar(list, races) {
  const now = Date.now();
  const nextIndex = races.findIndex((r) => {
    const d = sessionDate({ date: r.date, time: r.time || '00:00:00Z' });
    return d && d.getTime() > now;
  });
  list.innerHTML = races.map((r, i) => {
    const d = sessionDate({ date: r.date, time: r.time || '00:00:00Z' });
    const isNext = i === nextIndex;
    const isDone = d && d.getTime() < now && !isNext;
    return `
      <li class="calendar-row${isNext ? ' is-next' : ''}${isDone ? ' is-done' : ''}">
        <span class="rnd">R${r.round}</span>
        <span class="name">${flagEmoji(r.Circuit?.Location?.country)} ${r.raceName}</span>
        <span class="loc">${r.Circuit?.Location?.locality || ''}</span>
        <span class="date">${d ? DATE_FMT_SHORT.format(d) : ''}</span>
        ${isNext ? '<span class="next-tag">Próxima</span>' : ''}
      </li>
    `;
  }).join('');
}

export async function initRaceCenterResultsPage(root) {
  if (!root) return;
  wireTabs(root);

  const lastRaceNameEl = root.querySelector('[data-rc-lastrace-name]');
  const lastRaceBody = root.querySelector('[data-rc-lastrace-body]');
  const fastestLapEl = root.querySelector('[data-rc-fastest-lap]');
  const qualiNameEl = root.querySelector('[data-rc-quali-name]');
  const qualiBody = root.querySelector('[data-rc-quali-body]');
  const driversBody = root.querySelector('[data-rc-drivers-body]');
  const constructorsBody = root.querySelector('[data-rc-constructors-body]');
  const calendarEl = root.querySelector('[data-rc-calendar]');

  // Las 5 pestañas se piden todas en paralelo pero cada una se pinta en
  // cuanto llega su propia respuesta — así la pestaña activa (Última
  // carrera) no espera a que respondan también clasificación, pilotos,
  // constructores y calendario.
  const tasks = [
    getLastRaceResults().then((lastRace) => {
      if (lastRace) {
        const raceStart = sessionDate({ date: lastRace.date, time: lastRace.time });
        lastRaceNameEl.textContent = `Ronda ${lastRace.round} — ${lastRace.raceName}${raceStart ? ` (${DATE_FMT.format(raceStart)})` : ''}`;
        renderRaceResultTable(lastRaceBody, lastRace.Results || []);
        if (fastestLapEl) renderFastestLap(fastestLapEl, lastRace.Results || []);
      } else {
        lastRaceNameEl.textContent = 'Todavía no se ha disputado ninguna carrera esta temporada.';
      }
    }).catch(() => { if (lastRaceNameEl) lastRaceNameEl.textContent = 'No se ha podido conectar con la API de F1.'; }),

    getLastRaceQualifying().then((qualifying) => {
      if (qualifying && qualiNameEl && qualiBody) {
        qualiNameEl.textContent = `Ronda ${qualifying.round} — ${qualifying.raceName}`;
        renderQualifyingTable(qualiBody, qualifying.QualifyingResults || []);
      } else if (qualiNameEl) {
        qualiNameEl.textContent = 'Sin datos de clasificación todavía.';
      }
    }).catch(() => { if (qualiNameEl) qualiNameEl.textContent = 'No se ha podido conectar con la API de F1.'; }),

    getDriverStandings().then((drivers) => {
      if (driversBody) renderDriverStandingsTable(driversBody, drivers);
    }).catch(() => { if (driversBody) driversBody.innerHTML = '<tr><td colspan="4" class="rc-status">No se ha podido conectar con la API de F1.</td></tr>'; }),

    getConstructorStandings().then((constructors) => {
      if (constructorsBody) renderConstructorStandingsTable(constructorsBody, constructors);
    }).catch(() => { if (constructorsBody) constructorsBody.innerHTML = '<tr><td colspan="4" class="rc-status">No se ha podido conectar con la API de F1.</td></tr>'; }),

    getSeasonSchedule().then((schedule) => {
      if (calendarEl) renderCalendar(calendarEl, schedule);
    }).catch(() => { if (calendarEl) calendarEl.innerHTML = '<li class="rc-status">No se ha podido conectar con la API de F1.</li>'; }),
  ];

  await Promise.allSettled(tasks);
}
