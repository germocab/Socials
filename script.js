'use strict';
/* ================= STATE & STORAGE ================= */
const KEY = 'socials.v1';
const APP_VERSION = '1.1';
// Baseline answer -> weekly capacity in load points (= 100%). Adjustable later from history.
const CAPACITY = { veryLight: 12, light: 16, balanced: 20, busy: 26, veryBusy: 32 };
const DEMANDING = 4; // a day with >= 4 load points counts as "demanding"
const state = { settings: { resetDay: 1, baseline: 'balanced', theme: 'auto', onboardingCompleted: false }, events: [] };
const ui = { view: 'home', weekStart: null, month: new Date(), selected: null, ob: 0, draft: 3 };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LEVELS = [null,
  { n: 'Very easy', d: 'Light and low-pressure.' }, { n: 'Easy', d: 'Manageable, with a little effort.' },
  { n: 'Moderate', d: 'This will take some noticeable energy.' }, { n: 'High', d: 'This might take a lot out of you.' },
  { n: 'Very high', d: 'You may want real recovery time afterward.' }];
const CATS = { social: 'social', party: 'sparkles', dinner: 'dinner', work: 'work', family: 'heart', outing: 'sun' }; // category -> icon name
const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2M6 11v2M10 11v2"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  social: '<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
  dinner: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 21V3c-2 1-3 4-3 8h3"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>'
};
const icon = (n, s = 20) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[n] || ''}</svg>`;
const THEMES = { auto: ['Automatic', 'monitor'], dark: ['Dark mode', 'moon'], light: ['Light mode', 'sun'] };
const themeMq = matchMedia('(prefers-color-scheme:dark)');
function applyTheme() { // 'auto' follows the system via CSS; we also sync the browser bar colour
  const t = state.settings.theme, dark = t === 'dark' || (t === 'auto' && themeMq.matches);
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = dark ? '#15171c' : '#f6f4ef';
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BASELINES = { veryLight: 'Very light', light: 'Light', balanced: 'Balanced', busy: 'Busy', veryBusy: 'Very busy' };

const Store = {
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.events) && s.settings) {
        Object.assign(state.settings, s.settings);
        state.events = s.events.filter(isValidEvent);
      }
    } catch (e) { console.warn('Stored data unreadable, starting fresh'); }
    if (!(state.settings.theme in { auto: 1, dark: 1, light: 1 })) state.settings.theme = 'auto';
    if (!(state.settings.baseline in CAPACITY)) state.settings.baseline = 'balanced';
    const rd = Number(state.settings.resetDay); state.settings.resetDay = rd >= 0 && rd <= 6 ? rd : 1;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Could not save (storage unavailable).'); } }
};

/* ================= DATE HELPERS ================= */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const validDate = s => /^\d{4}-\d\d-\d\d$/.test(s) && iso(parse(s)) === s;
const dayName = s => parse(s).toLocaleDateString(undefined, { weekday: 'long' });
const shortDate = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTime = t => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// Start of the battery week containing date d, based on the user's reset day.
const weekStart = d => addDays(d, -((d.getDay() - state.settings.resetDay + 7) % 7));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round1 = n => Math.round(n * 10) / 10;

/* ================= BATTERY ALGORITHM ================= */
function isValidEvent(e) {
  return e && typeof e.title === 'string' && validDate(e.date) && /^\d\d:\d\d$/.test(e.startTime) && /^\d\d:\d\d$/.test(e.endTime)
    && Number.isInteger(e.battery) && e.battery >= 1 && e.battery <= 5;
}
const hoursOf = e => Math.max(0, (mins(e.endTime) - mins(e.startTime)) / 60);
// Longer events cost more: <1h x0.75, 1-2h x1, 2-3h x1.25, 3-5h x1.5, 5h+ x1.75
const durationMultiplier = h => h < 1 ? .75 : h <= 2 ? 1 : h <= 3 ? 1.25 : h <= 5 ? 1.5 : 1.75;
const eventLoad = e => e.battery * durationMultiplier(hoursOf(e));
const eventsOn = (d, list = state.events) => list.filter(e => e.date === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
const dayLoad = (d, list = state.events) => eventsOn(d, list).reduce((a, e) => a + eventLoad(e), 0);
const capacity = () => CAPACITY[state.settings.baseline];
// Maps daily load points to a 0-5 "day level" (used for the daily breakdown and calendar shading).
const dayLevel = load => load <= 0 ? 0 : Math.min(5, Math.ceil(load / 2));

function weekStats(start) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = iso(addDays(start, i)); return { date: d, load: dayLoad(d), evs: eventsOn(d) }; });
  const evs = days.flatMap(d => d.evs), total = days.reduce((a, d) => a + d.load, 0);
  let run = 0, streak = 0;
  days.forEach(d => { run = d.load >= DEMANDING ? run + 1 : 0; streak = Math.max(streak, run); });
  const top = days.reduce((a, d) => d.load > a.load ? d : a, days[0]);
  return { start, end: addDays(start, 6), days, evs, total, top, streak,
    pct: Math.round(total / capacity() * 100), high: evs.filter(e => e.battery >= 4).length,
    avg: evs.length ? evs.reduce((a, e) => a + e.battery, 0) / evs.length : 0 };
}
// Consecutive demanding days ending on date d (spans week boundaries).
function streakEnding(d) { let n = 0; while (n < 30 && dayLoad(iso(d)) >= DEMANDING) { n++; d = addDays(d, -1); } return n; }
const levelLabel = p => p < 35 ? 'Light week' : p < 75 ? 'Balanced week' : p < 110 ? 'Moderately busy' : 'Very busy';
const fillClass = p => p >= 110 ? 'vhi' : p >= 75 ? 'hi' : '';

/* ================= RECOMMENDATIONS ================= */
function recommend(ws) {
  const today = new Date(), streak = Math.max(streakEnding(today), streakEnding(addDays(today, -1)));
  const soon = [1, 2].map(i => addDays(today, i)).filter(d => dayLoad(iso(d)) >= DEMANDING).map(d => WEEKDAYS[d.getDay()]);
  if (!ws.evs.length) return { title: 'Your week is wide open', text: 'Plenty of room for social plans, or for quiet time.' };
  if (streak >= 3) return { title: 'Time to recharge?', text: `You've had ${streak} demanding social days in a row. ` + (soon.length ? `Your next few days look busy too. Consider keeping ${soon.join(' and ')} lighter.` : 'A quieter day could help you recharge.') };
  if (streak === 2) return { title: 'Take it easy tomorrow', text: 'You have had two demanding social days in a row.' };
  if (ws.pct >= 110) return { title: 'A very social-heavy schedule', text: 'Consider moving or shortening one of your higher-energy events if possible.' };
  if (ws.pct >= 75) return { title: 'A socially busy week', text: 'Consider leaving some downtime between events.' };
  if (ws.pct >= 35) return { title: 'Looking balanced', text: 'You have a few social plans coming up. Your week looks balanced so far.' };
  return { title: 'A calm week', text: 'Your week looks pretty calm. You have plenty of room for social plans.' };
}
// Immediate feedback for an event being created/edited (excluding its own saved copy).
function eventFeedback(e) {
  const others = state.events.filter(x => x.id !== e.id), name = dayName(e.date), add = eventLoad(e);
  const dayBefore = dayLoad(e.date, others), dayAfter = dayBefore + add, start = weekStart(parse(e.date));
  const wk = Array.from({ length: 7 }, (_, i) => dayLoad(iso(addDays(start, i)), others));
  const pctAfter = (wk.reduce((a, b) => a + b, 0) + add) / capacity() * 100, busiest = Math.max(...wk);
  const size = add >= 5 ? 'a significant' : add >= 3 ? 'a moderate' : 'a small';
  if (pctAfter >= 75) return `Your week is already looking busy. This event would make ${name} ${dayAfter >= busiest ? 'one of your most demanding days' : 'a fuller day'}.`;
  if (dayBefore >= DEMANDING) return `This adds ${size} amount of social load to ${name}, which already has plans, so the day may feel fuller.`;
  return `This adds ${size} amount of social load to ${name}. Your week still has room.`;
}

/* ================= RENDERING: SHARED PIECES ================= */
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const dur = e => { const h = hoursOf(e); return h % 1 ? `${round1(h)}h` : `${h}h`; };
const pips = n => `<span class="pips" aria-hidden="true">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const evLabel = e => `${esc(e.title)}, battery ${e.battery} of 5. Open details`;
const evTitle = e => `${e.completed ? icon('check', 14) + ' ' : ''}${esc(e.title)}`;
const evMeta = e => `${icon(CATS[e.category] || 'social', 14)} ${fmtTime(e.startTime)}–${fmtTime(e.endTime)} · ${dur(e)}`;
// Upcoming (Home): date tile + details + battery meter
const eventCard = e => { const d = parse(e.date); return `<button class="ev b${e.battery}" data-ev="${e.id}" aria-label="${evLabel(e)}">
  <span class="dt"><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { month: 'short' })}</small></span>
  <span class="ev-m"><b>${evTitle(e)}</b><small>${evMeta(e)}</small></span>
  <span class="bat">${pips(e.battery)}<i>${e.battery}/5 · ${LEVELS[e.battery].n}</i></span></button>`; };
// Calendar day list: timeline-style card with time column
const dayEventCard = e => `<button class="cev b${e.battery}" data-ev="${e.id}" aria-label="${evLabel(e)}">
  <span class="tm"><b>${fmtTime(e.startTime)}</b><small>${fmtTime(e.endTime)}</small></span><span class="rail"></span>
  <span class="ev-m"><b>${evTitle(e)}</b><small>${icon(CATS[e.category] || 'social', 14)} ${dur(e)}${e.notes ? ' · ' + esc(e.notes) : ''}</small></span>
  <span class="bat">${pips(e.battery)}<i>${e.battery}/5</i></span></button>`;
const emptyState = () => `<div class="empty card"><h3>Your week is wide open.</h3><p>Add your first event and Socials will start learning how your week feels.</p><button class="btn" data-add>Add your first event</button></div>`;

/* ================= VIEWS ================= */
function viewHome() {
  const now = new Date(), t = iso(now), ws = weekStats(weekStart(now)), r = recommend(ws), h = now.getHours();
  const up = state.events.filter(e => e.date >= t && !e.completed).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 6);
  const n = ws.evs.filter(e => e.date >= t && !e.completed).length;
  return `<div class="view-in"><header class="hd"><h1>${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}</h1><p>How's your social week looking?</p></header>
  <div class="grid"><div>
   <button class="card hero" data-go="battery" aria-label="This week ${ws.pct} percent. Open battery details"><small>THIS WEEK</small>
    <div class="big"><span data-count="${ws.pct}">0</span>%</div><div class="bar"><i class="${fillClass(ws.pct)}" data-w="${Math.min(100, ws.pct)}"></i></div>
    <strong>${levelLabel(ws.pct)}</strong><p>${n ? `You have ${n} social event${n > 1 ? 's' : ''} coming up.` : 'Nothing else planned this week.'}</p></button>
   <section class="card rec" style="margin-top:14px"><small>${icon('bulb', 16)} ${esc(r.title.toUpperCase())}</small><p>${esc(r.text)}</p></section></div>
  <section class="up"><h2>Upcoming</h2>${up.length ? up.map(eventCard).join('') : emptyState()}</section></div></div>`;
}

function viewCalendar() {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1), t = iso(new Date());
  ui.selected = ui.selected || t;
  let cells = WEEKDAYS.map(d => `<div class="dw" aria-hidden="true">${d[0]}</div>`).join('') + '<div class="day off"></div>'.repeat(first.getDay());
  for (let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++) {
    const s = iso(new Date(y, mo, d)), load = dayLoad(s), lv = dayLevel(load), cnt = eventsOn(s).length;
    cells += `<button class="day l${lv}${s === ui.selected ? ' sel' : ''}${s === t ? ' today' : ''}" data-day="${s}" aria-label="${s}, ${cnt} events, social level ${lv} of 5" aria-pressed="${s === ui.selected}">${d}<small aria-hidden="true">${lv || ''}</small></button>`;
  }
  const evs = eventsOn(ui.selected);
  return `<div class="view-in"><div class="cal-h"><button data-month="-1" aria-label="Previous month">${icon('left')}</button><h1 style="font-size:1.4rem">${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1><button data-month="1" aria-label="Next month">${icon('right')}</button></div>
  <div class="cal card" role="group">${cells}</div>
  <p class="legend">Number under a date = that day's social level (1–5).</p>
  <h2>${dayName(ui.selected)}, ${shortDate(parse(ui.selected))}</h2>
  ${evs.length ? evs.map(dayEventCard).join('') : `<div class="empty card"><p>Nothing planned this day.</p><button class="btn ghost" data-add="${ui.selected}">Add an event</button></div>`}</div>`;
}

function viewBattery() {
  const cur = weekStart(new Date()), start = ui.weekStart || cur, isCur = iso(start) === iso(cur), ws = weekStats(start);
  const rec = isCur ? recommend(ws) : { title: 'Past week', text: 'A look back at how this week felt on paper.' };
  const remaining = Math.max(0, round1(capacity() - ws.total));
  const stat = (l, v) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`;
  const weeks = [];
  for (let i = 0; i < 12; i++) { const s = addDays(cur, -7 * i), w = weekStats(s); if (i === 0 || w.evs.length) weeks.push(w); }
  return `<div class="view-in"><header class="hd"><h1>Battery</h1><p>${isCur ? 'Current week' : 'Past week'} · ${shortDate(ws.start)}–${shortDate(ws.end)}</p></header>
  <div class="card hero" style="cursor:default"><small>SOCIAL BATTERY (ESTIMATE)</small><div class="big"><span data-count="${ws.pct}">0</span>%</div>
   <div class="bar" role="progressbar" aria-valuenow="${ws.pct}" aria-valuemin="0" aria-valuemax="100"><i class="${fillClass(ws.pct)}" data-w="${Math.min(100, ws.pct)}"></i></div>
   <strong>${levelLabel(ws.pct)}</strong><p>${esc(rec.text)}</p></div>
  <div class="stats">${stat('LOAD', `${round1(ws.total)} / ${capacity()} pts`)}${stat('EVENTS', ws.evs.length)}${stat('HIGH-INTENSITY', ws.high)}${stat('AVG INTENSITY', ws.evs.length ? round1(ws.avg) + '/5' : '–')}
   ${stat('MOST DEMANDING', ws.top.load ? dayName(ws.top.date) : '–')}${stat('LONGEST DEMANDING RUN', ws.streak + ' day' + (ws.streak === 1 ? '' : 's'))}${stat('CAPACITY LEFT', remaining + ' pts')}</div>
  <h2>Daily breakdown</h2><div class="card">${ws.days.map(d => `<div class="row"><span>${dayName(d.date).slice(0, 3)}</span><div class="bar"><i class="${d.load >= 8 ? 'vhi' : d.load >= DEMANDING ? 'hi' : ''}" data-w="${Math.min(100, d.load * 10)}"></i></div><span>${dayLevel(d.load)}/5 · ${round1(d.load)}pt</span></div>`).join('')}</div>
  <h2>Weeks</h2>${weeks.map(w => `<button class="wk" data-week="${iso(w.start)}" aria-current="${iso(w.start) === iso(start)}"><span>${shortDate(w.start)}–${shortDate(w.end)}</span><b>${w.pct}% social load</b></button>`).join('')}</div>`;
}

function viewSettings() {
  const s = state.settings;
  return `<div class="view-in"><header class="hd"><h1>Settings</h1><p>Your preferences stay on this device.</p></header><div class="card">
  <label id="s-thl">Appearance</label><div class="chips" role="radiogroup" aria-labelledby="s-thl">${Object.entries(THEMES).map(([k, [n, ic]]) => `<button class="chip ${k === s.theme ? 'on' : ''}" role="radio" aria-checked="${k === s.theme}" data-theme-set="${k}">${icon(ic, 16)} ${n}</button>`).join('')}</div>
  <label for="s-reset">Social Battery resets on</label><select id="s-reset">${WEEKDAYS.map((d, i) => `<option value="${i}" ${i === s.resetDay ? 'selected' : ''}>${d}</option>`).join('')}</select>
  <label for="s-base">A typical social week feels</label><select id="s-base">${Object.entries(BASELINES).map(([k, v]) => `<option value="${k}" ${k === s.baseline ? 'selected' : ''}>${v} (${CAPACITY[k]} pts = 100%)</option>`).join('')}</select>
  <p style="color:var(--mute);font-size:.9rem">The percentage is an app-generated estimate, not a medical measurement. Ratings are yours.</p>
  <div class="acts"><button class="btn ghost" data-act="replay">Replay intro</button><button class="btn danger" data-act="wipe">Delete all data</button></div></div>
  <p class="ver">Socials · Version ${APP_VERSION}</p></div>`;
}

/* ================= NAVIGATION & RENDER LOOP ================= */
const VIEWS = { home: viewHome, calendar: viewCalendar, battery: viewBattery, settings: viewSettings };
function render() {
  $('#view').innerHTML = VIEWS[ui.view]();
  $$('#nav [data-go]').forEach(b => b.dataset.go === ui.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#fab').hidden = ui.view === 'settings';
  requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]').forEach(el => el.style.width = el.dataset.w + '%')));
  $$('[data-count]').forEach(el => { // animated percentage
    const to = +el.dataset.count, t0 = performance.now(), quick = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const step = t => { const p = quick ? 1 : Math.min(1, (t - t0) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function go(v) { ui.view = v; if (v === 'battery') ui.weekStart = null; render(); scrollTo(0, 0); }

/* ================= EVENT CRUD & MODAL ================= */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
function saveEvent(e) { const i = state.events.findIndex(x => x.id === e.id); i >= 0 ? state.events[i] = e : state.events.push(e); Store.save(); }
function deleteEvent(id) { state.events = state.events.filter(e => e.id !== id); Store.save(); }

function openEvent(id, presetDate) {
  const ex = state.events.find(e => e.id === id), dlg = $('#dlg');
  const e = ex || { title: '', date: presetDate || (ui.view === 'calendar' && ui.selected) || iso(new Date()), startTime: '19:00', endTime: '21:00', battery: 3, category: 'social', notes: '', completed: false };
  ui.draft = e.battery;
  dlg.innerHTML = `<h2 id="dlg-title" style="margin-top:0">${ex ? 'Edit event' : 'Add event'}</h2>
  <div id="f"><label for="f-title">What are you doing?</label><input id="f-title" maxlength="80" value="${esc(e.title)}" placeholder="Dinner with friends" autocomplete="off">
  <label for="f-date">When?</label><input id="f-date" type="date" value="${e.date}">
  <div class="two"><div><label for="f-start">From</label><input id="f-start" type="time" value="${e.startTime}"></div><div><label for="f-end">To</label><input id="f-end" type="time" value="${e.endTime}"></div></div>
  <label id="f-bl">How much social energy will this take?</label><div class="pick b${e.battery}" id="pick" role="radiogroup" aria-labelledby="f-bl">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${n === e.battery}" aria-label="${n} of 5, ${LEVELS[n].n}" data-b="${n}" class="${n <= e.battery ? 'on' : ''}">★</button>`).join('')}</div>
  <div id="lvl"></div>
  <label for="f-cat">Type</label><select id="f-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === e.category ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select>
  <label for="f-notes">Notes</label><textarea id="f-notes" rows="2" placeholder="Anything you want to remember?">${esc(e.notes)}</textarea>
  ${ex ? `<label><input type="checkbox" id="f-done" style="width:auto;min-height:0" ${e.completed ? 'checked' : ''}> Mark as completed</label>` : ''}
  <div class="fb" id="fb" aria-live="polite"></div><div class="err" id="err" role="alert"></div>
  <div class="acts"><button class="btn" id="f-save">${ex ? 'Save changes' : 'Add event'}</button><button class="btn ghost" id="f-cancel">Cancel</button>${ex ? '<button class="btn danger" id="f-del">Delete</button>' : ''}</div></div>`;
  const read = () => ({ id: ex ? ex.id : uid(), title: $('#f-title').value.trim(), date: $('#f-date').value, startTime: $('#f-start').value, endTime: $('#f-end').value,
    battery: ui.draft, category: $('#f-cat').value, notes: $('#f-notes').value.trim(), completed: ex ? $('#f-done').checked : false, createdAt: ex ? ex.createdAt : new Date().toISOString() });
  const problem = v => !v.title ? 'Please name your event.' : !validDate(v.date) ? 'Please choose a valid date.' : !v.startTime || !v.endTime ? 'Please set a start and end time.'
    : mins(v.endTime) <= mins(v.startTime) ? 'End time needs to be after the start time.' : !(v.battery >= 1 && v.battery <= 5) ? 'Pick a battery level.' : '';
  const refresh = () => {
    const v = read(), b = ui.draft; $('#pick').className = 'pick b' + b;
    $$('#pick button').forEach(x => { x.classList.toggle('on', +x.dataset.b <= b); x.setAttribute('aria-checked', +x.dataset.b === b); });
    $('#lvl').innerHTML = `<b>${b}/5 — ${LEVELS[b].n}</b><br><span style="color:var(--mute)">${LEVELS[b].d}</span>`;
    $('#fb').textContent = !problem({ ...v, title: 'x' }) ? eventFeedback(v) : 'Set a date and time to see how this changes your week.';
  };
  $('#pick').onclick = ev => { const b = ev.target.closest('[data-b]'); if (b) { ui.draft = +b.dataset.b; refresh(); } };
  $('#f').oninput = refresh; refresh();
  $('#f-cancel').onclick = () => dlg.close();
  $('#f-save').onclick = () => { const v = read(), p = problem(v); if (p) { $('#err').textContent = p; return; } saveEvent(v); ui.selected = v.date; dlg.close(); render(); };
  if (ex) $('#f-del').onclick = () => { if (confirm('Delete this event?')) { deleteEvent(ex.id); dlg.close(); render(); } };
  dlg.showModal(); $('#f-title').focus();
}

/* ================= ONBOARDING ================= */
function renderOnboarding() {
  const o = $('#onb'), s = state.settings, n = 5, i = ui.ob;
  const slides = [
    `<div class="emoji">${icon('battery', 56)}</div><h1>Socials</h1><h2 style="margin:0">Your social energy, at a glance.</h2><p>Log the events you're attending, rate how much energy they take, and see how demanding your week really is.</p>`,
    `<h1>How it works</h1><p>Every event takes some amount of social energy.</p><div class="scale">${[1, 2, 3, 4, 5].map(k => `<div class="b${k}"><span class="stars">${stars(k)}</span><span>${k}/5 · ${LEVELS[k].n}</span></div>`).join('')}</div><p>Longer events count for more. Ratings are yours, never a diagnosis.</p>`,
    `<h1>Your reset day</h1><p>When should your Social Battery reset?</p><div class="chips" role="radiogroup">${WEEKDAYS.map((d, k) => `<button class="chip ${k === s.resetDay ? 'on' : ''}" role="radio" aria-checked="${k === s.resetDay}" data-reset="${k}">${d}</button>`).join('')}</div><p>This decides how Socials groups your weeks.</p>`,
    `<h1>Your baseline</h1><p>How busy does a typical social week feel to you?</p><div class="chips" role="radiogroup">${Object.entries(BASELINES).map(([k, v]) => `<button class="chip ${k === s.baseline ? 'on' : ''}" role="radio" aria-checked="${k === s.baseline}" data-base="${k}">${v}</button>`).join('')}</div><p>Optional. It sets your starting weekly capacity.</p>`,
    `<div class="emoji">${icon('sparkles', 56)}</div><h1>You're all set.</h1><div class="card"><p><b>Reset day:</b> ${WEEKDAYS[s.resetDay]}<br><b>Weekly baseline:</b> ${BASELINES[s.baseline]} (${capacity()} points = 100%)</p></div><p>Each event adds load based on its rating and length. Your battery percentage is a friendly estimate you can always adjust in Settings.</p>`];
  o.innerHTML = `<div class="dots" aria-label="Step ${i + 1} of ${n}">${slides.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div><div class="slide" id="slide">${slides[i]}</div>
   <div class="acts">${i ? '<button class="btn ghost" data-ob="-1">Back</button>' : ''}<button class="btn" data-ob="1">${i === n - 1 ? 'Start using Socials' : i === 0 ? 'Get started' : 'Next'}</button></div>`;
  o.hidden = false;
}
function finishOnboarding() { state.settings.onboardingCompleted = true; Store.save(); $('#onb').hidden = true; ui.weekStart = null; render(); }

/* ================= EVENTS (DELEGATED) ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-ev],[data-add],[data-week],[data-day],[data-month],[data-act],[data-reset],[data-base],[data-ob],[data-theme-set]');
  if (!t) return; const d = t.dataset;
  if ('go' in d) go(d.go);
  else if ('ev' in d) openEvent(d.ev);
  else if ('add' in d) openEvent(null, d.add || undefined);
  else if ('week' in d) { ui.weekStart = parse(d.week); render(); scrollTo({ top: 0, behavior: 'smooth' }); }
  else if ('day' in d) { ui.selected = d.day; render(); }
  else if ('month' in d) { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + +d.month, 1); render(); }
  else if ('themeSet' in d) { state.settings.theme = d.themeSet; Store.save(); applyTheme(); render(); }
  else if ('reset' in d) { state.settings.resetDay = +d.reset; renderOnboarding(); }
  else if ('base' in d) { state.settings.baseline = d.base; renderOnboarding(); }
  else if ('ob' in d) { ui.ob += +d.ob; ui.ob >= 5 ? finishOnboarding() : renderOnboarding(); }
  else if (d.act === 'replay') { ui.ob = 0; renderOnboarding(); }
  else if (d.act === 'wipe' && confirm('Delete all events and settings on this device?')) { localStorage.removeItem(KEY); location.reload(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 's-reset') state.settings.resetDay = +e.target.value;
  else if (e.target.id === 's-base') state.settings.baseline = e.target.value; else return;
  Store.save(); ui.weekStart = null;
});
$('#dlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ================= PWA ================= */
function initPWA() {
  if (!('serviceWorker' in navigator)) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW failed', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); }); // new version took over
}

/* ================= INIT ================= */
Store.load(); applyTheme(); themeMq.addEventListener('change', applyTheme);
$$('#nav [data-go]').forEach(b => b.querySelector('span').innerHTML = icon(b.dataset.go));
$('#brand-i').innerHTML = icon('battery', 22);
if (!state.settings.onboardingCompleted) renderOnboarding();
render(); initPWA();
