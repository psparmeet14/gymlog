'use strict';
/* Gymlog: local-first workout log. All data stays in this browser (localStorage); nothing is sent anywhere. */

const KEY = 'gymlog.v1';
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings & glutes', 'Biceps', 'Triceps', 'Calves', 'Abs', 'Other'];
const VOLUME_ROWS = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings & glutes', 'Biceps', 'Triceps'];
const UNIT = { barbell: 'kg per side', kg: 'kg', plates: 'plates', bw: 'added kg', time: '' };
const INC = { barbell: 2.5, kg: 2.5, plates: 1, bw: 2.5, time: 0 };
const TYPE_LABEL = { barbell: 'Barbell (kg per side)', kg: 'Dumbbell / machine (kg)', plates: 'Stack (plates)', bw: 'Bodyweight', time: 'Timed (seconds)' };
const SET_TARGET = 10;   // hard sets per muscle per week
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_EX = {
  'Barbell bench press': ['Chest', 'barbell'], 'Incline DB press': ['Chest', 'kg'], 'DB bench press': ['Chest', 'kg'],
  'Seated machine row': ['Back', 'plates'], 'Pull-ups': ['Back', 'bw'], 'One-arm DB row': ['Back', 'kg'],
  'Seated DB press': ['Shoulders', 'kg'], 'Lateral raise': ['Shoulders', 'kg'], 'Face pulls': ['Shoulders', 'plates'],
  'Back squat': ['Quads', 'barbell'], 'Bulgarian split squat': ['Quads', 'kg'], 'Leg press': ['Quads', 'kg'], 'Leg extension': ['Quads', 'plates'],
  'Deadlift': ['Hamstrings & glutes', 'barbell'], 'Leg curl': ['Hamstrings & glutes', 'plates'],
  'Barbell curl': ['Biceps', 'kg'], 'Triceps pushdown': ['Triceps', 'plates'],
  'Standing calf raise': ['Calves', 'plates'], 'Seated calf raise': ['Calves', 'kg'],
  'Hanging knee raise': ['Abs', 'bw'], 'Crunches': ['Abs', 'bw'], 'Plank': ['Abs', 'time'],
};
const P = (ex, sets, min, max) => ({ ex, sets, min, max });
const DEFAULT_PLAN = [
  { name: 'Upper body 1', items: [P('Barbell bench press', 3, 6, 10), P('Seated machine row', 3, 8, 12), P('Incline DB press', 3, 8, 12), P('Lateral raise', 3, 10, 15), P('Barbell curl', 3, 8, 12), P('Hanging knee raise', 2, 8, 15)] },
  { name: 'Lower body 1', items: [P('Back squat', 3, 6, 10), P('Leg curl', 3, 8, 12), P('Bulgarian split squat', 2, 8, 12), P('Standing calf raise', 3, 10, 15), P('Plank', 2, 45, 90)] },
  { name: 'Upper body 2', items: [P('Seated DB press', 3, 6, 10), P('Pull-ups', 3, 5, 10), P('DB bench press', 3, 8, 12), P('One-arm DB row', 3, 8, 12), P('Triceps pushdown', 3, 10, 15), P('Face pulls', 2, 12, 15)] },
  { name: 'Lower body 2', items: [P('Deadlift', 3, 5, 8), P('Leg press', 3, 8, 12), P('Leg extension', 3, 10, 15), P('Leg curl', 2, 10, 15), P('Seated calf raise', 3, 10, 15), P('Crunches', 2, 12, 20)] },
];
const DEFAULT_KEY = ['Barbell bench press', 'Back squat', 'Deadlift', 'Seated DB press', 'Pull-ups'];

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const weekStart = s => addDays(s, -((toDate(s).getDay() + 6) % 7));
const fmtDate = (s, year) => { const d = toDate(s); return `${d.getDate()} ${MON[d.getMonth()]}` + (year || d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''); };
const num = x => +(+x).toFixed(2);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const roundTo = (x, inc) => inc > 0 ? num(Math.round(x / inc) * inc) : num(x);
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- state ---------- */
function fresh() {
  const exercises = {};
  for (const [n, [muscle, type]] of Object.entries(DEFAULT_EX)) exercises[n] = { muscle, type };
  return { v: 1, settings: { bar: 20, target: 4, protein: 130, key: [...DEFAULT_KEY] }, exercises, plan: clone(DEFAULT_PLAN), sessions: [], body: [], draft: null };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && Array.isArray(s.sessions)) return s; } catch (e) { /* fall through */ }
  return fresh();
}
let S = load();
let _idx = null;
const ui = { tab: 'today', range: '1Y', detail: null, shown: 30, open: null, flash: null };
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Could not save: storage is full or blocked.'); } }
function commit() { _idx = null; save(); }

function exInfo(name) {
  const e = S.exercises[name] || { muscle: 'Other', type: 'kg' };
  return { muscle: e.muscle, type: e.type, inc: e.inc != null ? e.inc : INC[e.type] };
}
function idx() {
  if (_idx) return _idx;
  const byEx = {}, sorted = [...S.sessions].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  for (const s of sorted) for (const e of s.entries) if (e.sets.length) (byEx[e.ex] = byEx[e.ex] || []).push({ date: s.date, sets: e.sets, est: e.est });
  return _idx = { byEx, sorted, dates: [...new Set(sorted.map(s => s.date))] };
}
const lastDate = () => { const d = idx().dates; return d.length ? d[d.length - 1] : null; };

/* ---------- strength maths ---------- */
function score(info, w, r) {           // one number per set: est. 1-rep max (Epley), or reps / seconds
  if (info.type === 'time' || info.type === 'bw') return r;
  const load = info.type === 'barbell' ? 2 * w + S.settings.bar : w;
  return load > 0 ? load * (1 + Math.min(r, 12) / 30) : 0;
}
function bestSet(info, sets) {
  let b = null;
  for (const [w, r] of sets) { const v = score(info, w, r); if (v > 0 && (!b || v > b.v)) b = { v, w, r }; }
  return b;
}
function series(name) {
  const info = exInfo(name), out = [];
  for (const h of idx().byEx[name] || []) { const b = bestSet(info, h.sets); if (b) out.push({ date: h.date, est: h.est, ...b }); }
  return out;
}
const fmtVal = (info, v) => info.type === 'time' ? `${Math.round(v)} s` : info.type === 'bw' ? `${num(v)} reps` : info.type === 'plates' ? `${v.toFixed(1)} pl` : `${Math.round(v)} kg`;
const valLabel = info => info.type === 'time' ? 'best hold' : info.type === 'bw' ? 'best set' : 'est. 1-rep max';
function fmtLoad(info, w, r) {
  if (info.type === 'time') return `${r} s`;
  if (info.type === 'bw') return `${r} reps` + (w > 0 ? ` +${w} kg` : '');
  if (info.type === 'barbell') return `${num(2 * w + S.settings.bar)} kg × ${r}`;
  return `${w} ${info.type === 'plates' ? 'plates' : 'kg'} × ${r}`;
}
const fmtSets = (info, sets) => sets.map(([w, r]) => info.type === 'time' ? `${r}s` : w > 0 ? `${w}×${r}` : `${r}`).join(', ');

/* What to do today for one exercise: straight sets, add reps until the top of the range, then add weight. */
function targetFor(name, item) {
  const info = exInfo(name), hist = idx().byEx[name] || [], n = item.sets, lo = item.min, hi = item.max, inc = info.inc;
  const noLoad = info.type === 'bw' || info.type === 'time';
  if (!hist.length) return { w: noLoad ? 0 : null, reps: Array(n).fill(lo), note: noLoad ? 'First time.' : `First time: pick a weight you could do ${hi} times.` };
  const last = hist[hist.length - 1];
  const ws = [...new Set(last.sets.map(s => s[0]))].sort((a, b) => b - a);
  const at = w => last.sets.filter(s => s[0] === w).map(s => s[1]);
  let W = ws[0], reps, note, r = at(W);
  if (r.length >= n) {                                   // straight sets last time
    r = r.slice(0, n);
    if (r.every(x => x >= hi)) {
      if (inc > 0) { W = num(W + inc); reps = Array(n).fill(lo); note = `Every set reached ${hi}. Weight goes up.`; }
      else { reps = r; note = 'Top of the range. Make it harder.'; }
    } else {
      const i = r.findIndex(x => x < hi);
      reps = r.map((x, j) => j === i ? x + 1 : x);
      note = 'Same weight, one more rep.';
    }
  } else {                                               // ramped last time: heaviest weight done for at least `lo`
    const ok = ws.find(w => Math.max(...at(w)) >= lo);
    if (ok !== undefined) { W = ok; const m = clamp(Math.max(...at(ok)), lo, hi); reps = Array.from({ length: n }, (_, i) => Math.max(lo, m - i)); }
    else { W = roundTo(ws[0] * 0.9, inc); reps = Array(n).fill(lo); }
    note = noLoad ? 'Same reps or better on every set.' : 'Same weight on every set from now on.';
  }
  const gap = lastDate() ? dayDiff(lastDate(), today()) : 0;
  if (gap > 14 && !noLoad && W > 0) { W = roundTo(W * 0.9, inc); reps = Array(n).fill(lo); note = `Back after ${gap} days: about 90% to start.`; }
  return { w: W, reps, note };
}

/* ---------- draft (today's workout) ---------- */
function mkItem(it) {
  const t = targetFor(it.ex, it);
  return { ex: it.ex, min: it.min, max: it.max, note: t.note, sets: t.reps.map(r => ({ w: t.w, r, done: false })) };
}
function nextPlan() {
  const names = S.plan.map(p => p.name), ss = idx().sorted;
  for (let i = ss.length - 1; i >= 0; i--) { const k = names.indexOf(ss[i].name); if (k >= 0) return (k + 1) % names.length; }
  return 0;
}
const makeDraft = pi => ({ made: today(), date: today(), name: S.plan[pi].name, items: S.plan[pi].items.map(mkItem) });
const doneCount = d => d.items.reduce((a, it) => a + it.sets.filter(s => s.done).length, 0);
function getDraft() {
  let d = S.draft;
  if (d && !d.editId && !d.dateSet && d.made !== today() && !doneCount(d)) d = null;
  if (!d && S.plan.length) { d = S.draft = makeDraft(nextPlan()); save(); }
  return d;
}

/* ---------- analysis ---------- */
function weekCounts(n) {                // sessions per week, oldest first, last = this week
  const start = weekStart(today()), out = [];
  for (let i = n - 1; i >= 0; i--) { const a = addDays(start, -7 * i), b = addDays(a, 6); out.push({ start: a, n: idx().dates.filter(d => d >= a && d <= b).length }); }
  return out;
}
function hardSets(from, to) {           // sets within 10% of the day's top weight for that exercise, per muscle
  const out = {};
  for (const s of S.sessions) {
    if (s.date < from || s.date > to) continue;
    for (const e of s.entries) {
      if (!e.sets.length) continue;
      const top = Math.max(...e.sets.map(x => x[0]));
      const k = e.sets.filter(x => top <= 0 || x[0] >= 0.9 * top).length, m = exInfo(e.ex).muscle;
      out[m] = (out[m] || 0) + k;
    }
  }
  return out;
}
function trend(pts) {                   // % change vs the session closest to 8 weeks before the latest
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1], cut = addDays(last.date, -42);
  const prev = pts.filter(p => p.date <= cut && dayDiff(p.date, last.date) <= 150).pop();
  return prev ? (last.v / prev.v - 1) * 100 : null;
}
function stalled(pts) {
  if (pts.length < 4) return false;
  const a = pts[pts.length - 4], b = pts[pts.length - 1];
  return dayDiff(a.date, b.date) <= 75 && b.v <= a.v * 1.005;
}
function bodyStats() {
  const b = [...S.body].sort((x, y) => x.date < y.date ? -1 : 1), t = today();
  const pick = f => b.filter(x => x[f] != null);
  const change = f => {
    const v = pick(f); if (v.length < 2) return null;
    const last = v[v.length - 1], prev = v.filter(x => dayDiff(x.date, last.date) >= 21).pop();
    return prev ? num(last[f] - prev[f]) : null;
  };
  const w = pick('weight'), wa = pick('waist');
  const week = b.filter(x => dayDiff(x.date, t) < 7);
  return { weight: w.length ? w[w.length - 1].weight : null, waist: wa.length ? wa[wa.length - 1].waist : null, dW: change('weight'), dWaist: change('waist'),
    protein: week.filter(x => x.protein).length, last: b.length ? b[b.length - 1].date : null, weights: w };
}
function insights() {
  const out = [], t = today(), last = lastDate();
  if (!last) return [{ t: 'Bring in your history', d: 'Plan → Backup → Import, then pick history.json. Or just start today\'s workout.' }];
  const gap = dayDiff(last, t);
  if (gap >= 6) out.push({ t: `${gap} days since your last session`, d: gap > 14 ? 'Go today. Start at about 90% and build back within two weeks, with no retraining block.' : 'Go today. Missing one more week costs more than a light session.' });
  const wk = weekCounts(5).slice(0, 4), avg = wk.reduce((a, w) => a + w.n, 0) / 4;
  if (avg < 3) out.push({ t: `${avg.toFixed(1)} sessions a week over the last 4 full weeks`, d: `Three is the floor for progress; ${S.settings.target} is the plan.` });
  const sets = hardSets(addDays(t, -27), t);
  const low = VOLUME_ROWS.slice(0, 5).map(m => [m, (sets[m] || 0) / 4]).filter(x => x[1] < 8).sort((a, b) => a[1] - b[1]);
  if (low.length) out.push({ t: `Low volume: ${low.slice(0, 3).map(x => `${x[0].toLowerCase()} ${x[1].toFixed(0)}`).join(', ')} hard sets a week`, d: `Aim for ${SET_TARGET} or more per muscle. Doing every planned set gets you there.` });
  for (const name of S.settings.key) {
    const pts = series(name);
    if (stalled(pts) && dayDiff(pts[pts.length - 1].date, t) < 30) { out.push({ t: `No progress on ${name.toLowerCase()} in 4 sessions`, d: 'Keep the weight and win one more rep. If that fails twice, check protein and sleep before changing the plan.' }); break; }
  }
  const b = bodyStats();
  if (!b.last || dayDiff(b.last, t) > 8) out.push({ t: 'Log weight and waist this week', d: 'Same morning each week. Waist at the navel is your abs gauge.' });
  else if (b.protein < 5) out.push({ t: `Protein target hit ${b.protein} of the last 7 days`, d: `${S.settings.protein} g a day is the biggest lever you have not pulled yet.` });
  if (!out.length) out.push({ t: 'On track', d: 'Keep adding reps, then weight.' });
  return out.slice(0, 3);
}

/* ---------- charts ---------- */
let detailPts = [];
function lineChart(pts, o) {
  const W = o.w, H = o.h, d = o.detail, pl = d ? 34 : 4, pr = d ? 8 : 6, pt = d ? 8 : 5, pb = d ? 18 : 5;
  if (!pts.length) return `<div class="empty" style="height:${H}px">No sessions in this range</div>`;
  const t0 = toDate(o.from).getTime(), t1 = Math.max(toDate(o.to).getTime(), t0 + 864e5);
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (hi === lo) { hi += 1; lo -= 1; }
  const m = (hi - lo) * 0.1; lo -= m; hi += m;
  const X = p => pl + (toDate(p.date).getTime() - t0) / (t1 - t0) * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const xy = pts.map(p => ({ x: X(p), y: Y(p.v), p }));
  const path = xy.map((q, i) => (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1)).join('');
  const end = xy[xy.length - 1];
  let g = '';
  if (d) {
    detailPts = xy;
    for (const v of [lo + m, (lo + hi) / 2, hi - m]) g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${pl - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${o.fmt(v)}</text>`;
    g += `<text x="${pl}" y="${H - 4}">${fmtDate(o.from, true)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${fmtDate(o.to, true)}</text>`;
    g += `<line class="xh" id="xh" y1="${pt}" y2="${H - pb}" x1="-9" x2="-9"/>`;
  }
  return `<svg ${d ? 'class="detail" ' : ''}width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'trend')}">${g}<path class="line" d="${path}"/>` +
    (xy.length === 1 || d ? '' : '') + `<circle class="dot" ${d ? 'id="xd" ' : ''}cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4"/></svg>`;
}
function rangeFrom() { const t = today(); return ui.range === '3M' ? addDays(t, -91) : ui.range === '1Y' ? addDays(t, -365) : null; }
function weeksChart(wk, W) {
  const H = 78, pt = 6, pb = 16, G = 46, step = (W - G) / wk.length, bw = Math.min(18, step - 4), max = Math.max(5, ...wk.map(w => w.n));
  const Y = n => pt + (1 - n / max) * (H - pt - pb);
  let g = `<line class="ref" x1="0" x2="${W - G + 4}" y1="${Y(3)}" y2="${Y(3)}"/><text x="${W}" y="${Y(3) + 3}" text-anchor="end">floor 3</text>`;
  wk.forEach((w, i) => {
    const x = i * step + (step - bw) / 2, h = Math.max(w.n ? 3 : 0, H - pb - Y(w.n)), lastBar = i === wk.length - 1;
    g += `<rect class="bar${lastBar ? '' : ' dim'}" data-tip="Week of ${fmtDate(w.start)}: ${w.n} session${w.n === 1 ? '' : 's'}" x="${x.toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, h / 2)}"/>`;
    g += `<rect data-tip="Week of ${fmtDate(w.start)}: ${w.n} session${w.n === 1 ? '' : 's'}" x="${(i * step).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H - pb}" fill="transparent"/>`;
  });
  g += `<line class="grid" x1="0" x2="${W - G + 4}" y1="${H - pb}" y2="${H - pb}"/><text x="2" y="${H - 4}">${fmtDate(wk[0].start)}</text><text x="${W - G}" y="${H - 4}" text-anchor="end">this week</text>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per week, last ${wk.length} weeks">${g}</svg>`;
}

/* ---------- views ---------- */
const view = $('#view');
const innerW = () => Math.min(560, document.documentElement.clientWidth) - 24 - 26;   // main padding + card padding/border

function exOptions(sel) {
  const by = {};
  for (const [n, e] of Object.entries(S.exercises)) (by[e.muscle] = by[e.muscle] || []).push(n);
  return MUSCLES.filter(m => by[m]).map(m => `<optgroup label="${esc(m)}">${by[m].sort().map(n => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
}
function stepper(f, v, ph) {
  return `<div class="stp"><button data-act="step" data-f="${f}" data-d="-1" aria-label="Less">−</button><input data-inp="${f}" inputmode="decimal" value="${v == null ? '' : v}" placeholder="${ph}" aria-label="${ph}"><button data-act="step" data-f="${f}" data-d="1" aria-label="More">+</button></div>`;
}
function itemHtml(it, i) {
  const info = exInfo(it.ex), h = idx().byEx[it.ex] || [], last = h[h.length - 1], t = info.type === 'time';
  return `<section class="card ex" data-i="${i}">
    <div class="exh"><h2>${esc(it.ex)}</h2><button class="icon" data-act="exmenu" aria-label="Change exercise">⋯</button></div>
    <p class="hint">${last ? `Last ${fmtDate(last.date)}: ${esc(fmtSets(info, last.sets))}` : 'Not logged before'}${UNIT[info.type] ? ` · ${UNIT[info.type]}` : ''}</p>
    <p class="goal">${esc(it.note || '')} ${it.min}–${it.max} ${t ? 'seconds' : 'reps'}.</p>
    ${it.sets.map((s, j) => `<div class="set${s.done ? ' done' : ''}" data-s="${j}"><span class="n">${j + 1}</span>${t ? '' : stepper('w', s.w, 'kg') + '<span class="x">×</span>'}${stepper('r', s.r, t ? 'sec' : 'reps')}<button class="check" data-act="done" aria-label="Set ${j + 1} done" aria-pressed="${s.done}">✓</button></div>`).join('')}
    <div class="between"><button class="link" data-act="addset">+ Add set</button>${it.sets.length > 1 ? '<button class="link muted" data-act="rmset">Remove last set</button>' : ''}</div>
  </section>`;
}
function renderToday() {
  const d = getDraft(), last = lastDate(), gap = last ? dayDiff(last, today()) : null;
  let h = `<h1>${d && d.editId ? 'Edit session' : 'Today'}</h1><p class="sub">${last ? `Last session ${fmtDate(last)}${gap === 0 ? ', today' : gap === 1 ? ', yesterday' : `, ${gap} days ago`}` : 'No sessions yet'}</p>`;
  if (ui.flash) h += `<section class="card flash"><b>Saved.</b> ${esc(ui.flash)}</section>`;
  if (!d) { view.innerHTML = h + '<p class="empty">Add a workout in Plan to get started.</p>'; return; }
  const names = S.plan.map(p => p.name);
  if (!names.includes(d.name)) names.unshift(d.name);
  h += `<div class="row"><select data-chg="workout" aria-label="Workout">${names.map(n => `<option${n === d.name ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><input type="date" data-chg="date" value="${d.date}" max="${today()}" aria-label="Date"></div>`;
  h += d.items.map(itemHtml).join('');
  h += `<button class="ghost" data-act="addex">+ Add exercise</button>
    <div class="finish"><button class="primary" data-act="finish">Finish · <span id="cnt">${doneCount(d)}</span> sets</button><button class="link danger" data-act="discard">${d.editId ? 'Cancel edit' : 'Discard'}</button></div>`;
  view.innerHTML = h;
}

function liftRow(name, from) {
  const info = exInfo(name), all = series(name), pts = from ? all.filter(p => p.date >= from) : all;
  if (!all.length) return `<div class="lift"><div class="meta"><div class="name">${esc(name)}</div><div class="small muted">Not logged yet</div></div></div>`;
  const cur = all[all.length - 1], sure = all.filter(p => !p.est), best = (sure.length ? sure : all).reduce((a, p) => p.v > a.v ? p : a), tr = trend(all);
  const chip = tr == null ? '' : Math.abs(tr) < 1.5 ? '<span class="chip flat">▬ flat</span>' : tr > 0 ? `<span class="chip up">▲ ${tr.toFixed(0)}%</span>` : `<span class="chip down">▼ ${Math.abs(tr).toFixed(0)}%</span>`;
  return `<button class="lift" data-act="detail" data-ex="${esc(name)}"><div class="meta"><div class="name">${esc(name)}</div>
    <div class="small ink2">${esc(fmtLoad(info, cur.w, cur.r))} · ${fmtDate(cur.date)}</div>
    <div class="small muted">Best ${esc(fmtVal(info, best.v))}, ${MON[toDate(best.date).getMonth()]} ${toDate(best.date).getFullYear()}</div></div>
    ${lineChart(pts, { w: 84, h: 38, from: from || all[0].date, to: today(), label: name + ' trend' })}
    <div class="val">${esc(fmtVal(info, cur.v))}<br>${chip}</div></button>`;
}
function detailHtml(name, from) {
  const info = exInfo(name), all = series(name), pts = from ? all.filter(p => p.date >= from) : all;
  return `<div class="between" style="margin-top:12px"><b>${esc(name)}</b><span class="small muted">${valLabel(info)}</span></div>
    <p class="tip" id="tip">${pts.length ? 'Drag across the chart to read a session.' : ''}</p>
    ${lineChart(pts, { w: innerW(), h: 150, detail: true, from: from || (all[0] ? all[0].date : today()), to: today(), fmt: v => info.type === 'plates' ? v.toFixed(1) : Math.round(v), label: name })}`;
}
function renderProgress() {
  const t = today(), from = rangeFrom(), W = innerW();
  const wk = weekCounts(12), avg4 = wk.slice(7, 11).reduce((a, w) => a + w.n, 0) / 4, thisWk = wk[11].n;
  const s7 = hardSets(addDays(t, -6), t), s28 = hardSets(addDays(t, -27), t), b = bodyStats(), te = S.body.find(x => x.date === t) || {};
  const keys = S.settings.key.filter(k => S.exercises[k]);
  const dl = v => v == null ? '' : `${v > 0 ? '+' : ''}${v} in 4 wks`;
  let h = `<h1>Progress</h1><p class="sub">${idx().dates.length} training days logged</p>
  <section class="card"><h3>Do this next</h3>${insights().map((x, i) => `<div class="todo"><i>${i + 1}</i><div><b>${esc(x.t)}</b><div class="small ink2">${esc(x.d)}</div></div></div>`).join('')}</section>

  <section class="card"><h3>Consistency</h3>
    <div class="between"><div><span class="big">${thisWk}</span> <span class="ink2">of ${S.settings.target} this week</span></div><div class="small ink2">${avg4.toFixed(1)} a week, last 4 full weeks</div></div>
    <p class="tip" id="wtip">Tap a bar for that week.</p>${weeksChart(wk, W)}</section>

  <section class="card"><div class="between"><h3>Strength</h3><div class="seg">${['3M', '1Y', 'All'].map(r => `<button data-act="range" data-r="${r}" aria-pressed="${ui.range === r}">${r}</button>`).join('')}</div></div>
    ${keys.map(k => liftRow(k, from)).join('')}
    ${ui.detail ? detailHtml(ui.detail, from) : ''}
    <label class="f" style="margin-top:12px">Any other exercise<select data-chg="detail"><option value="">Choose…</option>${exOptions(ui.detail)}</select></label></section>

  <section class="card"><h3>Hard sets, last 7 days</h3>
    ${VOLUME_ROWS.map(m => { const n = s7[m] || 0, a = (s28[m] || 0) / 4; return `<div class="vol"><span>${m === 'Hamstrings & glutes' ? 'Hams & glutes' : m}</span><div class="track"><div class="fill" style="width:${clamp(n / 20 * 100, 0, 100)}%"></div><div class="mark" style="left:${SET_TARGET / 20 * 100}%"></div></div><span class="n"><b>${n}</b> <span class="muted small">avg ${a.toFixed(0)}</span></span></div>`; }).join('')}
    <p class="small muted" style="margin-top:6px">Line marks ${SET_TARGET} sets, the weekly target per muscle. Avg is the last 4 weeks.</p></section>

  <section class="card"><h3>Body</h3>
    <div class="stats"><div><b>${b.weight != null ? b.weight : '–'}</b><span>kg ${dl(b.dW)}</span></div><div><b>${b.waist != null ? b.waist : '–'}</b><span>cm waist ${dl(b.dWaist)}</span></div><div><b>${b.protein}/7</b><span>protein days</span></div></div>
    ${b.weights.length > 1 ? lineChart(b.weights.map(x => ({ date: x.date, v: x.weight })), { w: W, h: 44, from: b.weights[0].date, to: t, label: 'Bodyweight trend' }) : ''}
    <div class="row" style="margin-top:8px"><label class="f">Weight (kg)<input id="bw" inputmode="decimal" type="text" value="${te.weight != null ? te.weight : ''}"></label><label class="f">Waist (cm)<input id="bwaist" inputmode="decimal" type="text" value="${te.waist != null ? te.waist : ''}"></label></div>
    <label class="toggle"><input type="checkbox" id="bprot"${te.protein ? ' checked' : ''}> Hit ${S.settings.protein} g protein today</label>
    <button class="btn" data-act="savebody" style="width:100%">Save today</button></section>`;
  view.innerHTML = h;
}

function renderHistory() {
  const ss = [...idx().sorted].reverse();
  let h = `<h1>History</h1><p class="sub">${ss.length} sessions${ss.length ? `, since ${fmtDate(ss[ss.length - 1].date, true)}` : ''}</p>`;
  if (!ss.length) h += '<p class="empty">Nothing yet. Import your old logs in Plan → Backup.</p>';
  let month = '';
  for (const s of ss.slice(0, ui.shown)) {
    const d = toDate(s.date), m = `${MON[d.getMonth()]} ${d.getFullYear()}`;
    if (m !== month) { if (month) h += '</section>'; h += `<h3 class="month">${m}</h3><section class="card">`; month = m; }
    const nsets = s.entries.reduce((a, e) => a + e.sets.length, 0), open = ui.open === s.id;
    h += `<button class="sess" data-act="open" data-id="${esc(s.id)}"><div class="between"><span class="d">${s.approx ? '≈ ' : ''}${d.getDate()} ${MON[d.getMonth()]} · ${esc(s.name)}</span><span class="small muted">${nsets} sets</span></div></button>`;
    if (open) {
      h += s.entries.map(e => `<div class="entry"><b>${esc(e.ex)}</b> <span>${esc(fmtSets(exInfo(e.ex), e.sets))}</span>${e.raw ? `<div class="raw">as logged: ${esc(e.raw)}</div>` : ''}</div>`).join('') || '<div class="entry muted">No exercises recorded.</div>';
      h += `<div class="between"><button class="link" data-act="edit" data-id="${esc(s.id)}">Edit</button><button class="link danger" data-act="del" data-id="${esc(s.id)}">Delete</button></div>`;
    }
  }
  if (month) h += '</section>';
  if (ss.length > ui.shown) h += `<button class="ghost" data-act="more">Show older</button>`;
  view.innerHTML = h;
}

function renderPlan() {
  let h = `<h1>Plan</h1><p class="sub">Four days, rotating. Keep the exercises fixed for 12 weeks.</p>`;
  S.plan.forEach((p, pi) => {
    h += `<section class="card" data-p="${pi}"><div class="between"><h2>${esc(p.name)}</h2><button class="link danger" data-act="rmworkout">Remove</button></div>
      <div class="pl"><span></span><span class="hd">sets</span><span class="hd">from</span><span class="hd">to</span><span></span></div>
      ${p.items.map((it, k) => `<div class="pl" data-k="${k}"><span>${esc(it.ex)}</span>${['sets', 'min', 'max'].map(f => `<input type="text" inputmode="numeric" data-chg="plan" data-f="${f}" value="${it[f]}" aria-label="${f}">`).join('')}<button class="icon" data-act="rmitem" aria-label="Remove">×</button></div>`).join('')}
      <button class="link" data-act="additem">+ Add exercise</button></section>`;
  });
  h += `<button class="ghost" data-act="addworkout">+ Add workout</button>
  <section class="card"><h3>Settings</h3><div class="row">
    <label class="f">Bar (kg)<input type="text" inputmode="decimal" data-chg="setting" data-f="bar" value="${S.settings.bar}"></label>
    <label class="f">Sessions / week<input type="text" inputmode="numeric" data-chg="setting" data-f="target" value="${S.settings.target}"></label>
    <label class="f">Protein (g)<input type="text" inputmode="numeric" data-chg="setting" data-f="protein" value="${S.settings.protein}"></label></div></section>
  <section class="card"><h3>Backup</h3><p class="small ink2" style="margin-bottom:10px">Everything is stored on this phone only. Export a backup now and then; import brings in a backup or your converted old logs (history.json).</p>
    <div class="row"><button class="btn" data-act="export">Export</button><button class="btn" data-act="import">Import</button></div>
    <button class="link danger" data-act="reset" style="margin-top:8px">Erase all data</button></section>`;
  view.innerHTML = h;
}

const VIEWS = { today: renderToday, progress: renderProgress, history: renderHistory, plan: renderPlan };
function render() {
  VIEWS[ui.tab]();
  for (const b of document.querySelectorAll('#tabs button')) b.toggleAttribute('aria-current', false), b.dataset.tab === ui.tab && b.setAttribute('aria-current', 'page');
}

/* ---------- dialog: pick or create an exercise ---------- */
const dlg = $('#dlg');
let dlgDone = null;
function pickExercise(title, extra, done) {
  dlgDone = done;
  dlg.innerHTML = `<h2>${esc(title)}</h2>
    <label class="f">Exercise<select id="dx"><option value="">New exercise…</option>${exOptions()}</select></label>
    <div id="dnew"><label class="f">Name<input type="text" id="dn" autocomplete="off"></label>
      <div class="row"><label class="f">Muscle<select id="dm">${MUSCLES.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label class="f">Logged as<select id="dt">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}"${k === 'kg' ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div></div>
    <div class="row"><button class="btn" data-act="dcancel">Cancel</button><button class="primary" data-act="dok" style="height:44px">OK</button></div>${extra || ''}`;
  $('#dx').onchange = e => { $('#dnew').hidden = !!e.target.value; };
  dlg.showModal();
}
function dialogResult() {
  let name = $('#dx').value;
  if (!name) {
    name = $('#dn').value.trim();
    if (!name) return null;
    if (!S.exercises[name]) S.exercises[name] = { muscle: $('#dm').value, type: $('#dt').value };
  }
  return name;
}

/* ---------- actions ---------- */
const where = el => { const c = el.closest('[data-i]'), s = el.closest('[data-s]'); return { i: c ? +c.dataset.i : -1, s: s ? +s.dataset.s : -1, card: c, row: s }; };
function setField(el, f, val) {
  const { i, s, card } = where(el), it = S.draft.items[i], st = it.sets[s];
  st[f] = val;
  if (f === 'w') for (let j = s + 1; j < it.sets.length; j++) if (!it.sets[j].done) {      // straight sets: later sets follow
    it.sets[j].w = val;
    const inp = $(`[data-s="${j}"] [data-inp="w"]`, card); if (inp) inp.value = val == null ? '' : val;
  }
  save();
}
const ACT = {
  tab(b) { ui.tab = b.dataset.tab; ui.flash = null; render(); window.scrollTo(0, 0); },
  step(b) {
    const { i, s, row } = where(b), it = S.draft.items[i], info = exInfo(it.ex), f = b.dataset.f;
    const inc = f === 'w' ? (info.inc || 1) : info.type === 'time' ? 5 : 1;
    const v = Math.max(0, num((it.sets[s][f] || 0) + (+b.dataset.d) * inc));
    $(`[data-inp="${f}"]`, row).value = v;
    setField(b, f, v);
  },
  done(b) {
    const { i, s, row } = where(b), st = S.draft.items[i].sets[s];
    if (!st.done && (st.w == null || !(st.r > 0))) { alert('Enter the weight and reps first.'); return; }
    st.done = !st.done; save();
    row.classList.toggle('done', st.done); b.setAttribute('aria-pressed', st.done);
    $('#cnt').textContent = doneCount(S.draft);
  },
  addset(b) { const it = S.draft.items[where(b).i], l = it.sets[it.sets.length - 1]; it.sets.push({ w: l ? l.w : null, r: l ? l.r : it.min, done: false }); save(); render(); },
  rmset(b) { S.draft.items[where(b).i].sets.pop(); save(); render(); },
  exmenu(b) {
    const i = where(b).i;
    pickExercise('Swap exercise', '<button class="link danger" data-act="rmex" style="margin-top:10px">Remove from today</button>', name => {
      const old = S.draft.items[i];
      S.draft.items[i] = mkItem({ ex: name, sets: old.sets.length, min: old.min, max: old.max });
    });
    dlg.dataset.i = i;
  },
  rmex() { S.draft.items.splice(+dlg.dataset.i, 1); save(); dlg.close(); render(); },
  addex() { pickExercise('Add exercise', '', name => S.draft.items.push(mkItem({ ex: name, sets: 3, min: 8, max: 12 }))); },
  dcancel() { dlg.close(); },
  dok() { const name = dialogResult(); if (!name) return; dlgDone(name); commit(); dlg.close(); render(); },
  finish() {
    const d = S.draft, entries = d.items.map(it => ({ ex: it.ex, sets: it.sets.filter(s => s.done).map(s => [num(s.w || 0), num(s.r)]) })).filter(e => e.sets.length);
    if (!entries.length) { alert('Tick at least one set first.'); return; }
    const prs = [];
    for (const e of entries) {
      const info = exInfo(e.ex), prev = series(e.ex).filter(p => !d.editId || p.date < d.date), b = bestSet(info, e.sets);
      if (b && prev.length && b.v > Math.max(...prev.map(p => p.v))) prs.push(`${e.ex} ${fmtLoad(info, b.w, b.r)}`);
    }
    const sess = { id: d.editId || 's' + Date.now(), date: d.date, name: d.name, entries };
    S.sessions = S.sessions.filter(s => s.id !== sess.id).concat(sess);
    S.draft = null; commit();
    const n = entries.reduce((a, e) => a + e.sets.length, 0);
    ui.flash = `${n} sets on ${fmtDate(sess.date)}.` + (prs.length ? ` Best ever: ${prs.join('; ')}.` : '') + (S.plan.length ? ` Next up: ${S.plan[nextPlan()].name}.` : '');
    render(); window.scrollTo(0, 0);
  },
  discard() { if (!doneCount(S.draft) || confirm('Discard this workout?')) { S.draft = null; save(); render(); } },
  range(b) { ui.range = b.dataset.r; render(); },
  detail(b) { ui.detail = ui.detail === b.dataset.ex ? null : b.dataset.ex; render(); },
  savebody() {
    const t = today(), f = id => { const v = parseFloat($(id).value.replace(',', '.')); return isFinite(v) && v > 0 ? num(v) : null; };
    const e = { date: t, weight: f('#bw'), waist: f('#bwaist'), protein: $('#bprot').checked };
    S.body = S.body.filter(x => x.date !== t).concat(e); save(); render();
  },
  open(b) { ui.open = ui.open === b.dataset.id ? null : b.dataset.id; render(); },
  more() { ui.shown += 60; render(); },
  del(b) { if (confirm('Delete this session?')) { S.sessions = S.sessions.filter(s => s.id !== b.dataset.id); commit(); render(); } },
  edit(b) {
    if (S.draft && doneCount(S.draft) && !confirm('This replaces the workout you have in progress. Continue?')) return;
    const s = S.sessions.find(x => x.id === b.dataset.id);
    S.draft = { editId: s.id, made: today(), date: s.date, name: s.name, items: s.entries.map(e => ({ ex: e.ex, min: 1, max: 99, note: '', sets: e.sets.map(([w, r]) => ({ w, r, done: true })) })) };
    save(); ui.tab = 'today'; render(); window.scrollTo(0, 0);
  },
  additem(b) { const pi = +b.closest('[data-p]').dataset.p; pickExercise('Add to ' + S.plan[pi].name, '', name => S.plan[pi].items.push(P(name, 3, 8, 12))); },
  rmitem(b) { S.plan[+b.closest('[data-p]').dataset.p].items.splice(+b.closest('[data-k]').dataset.k, 1); S.draft = S.draft && doneCount(S.draft) ? S.draft : null; save(); render(); },
  addworkout() { const n = prompt('Workout name'); if (n && n.trim()) { S.plan.push({ name: n.trim(), items: [] }); save(); render(); } },
  rmworkout(b) { const pi = +b.closest('[data-p]').dataset.p; if (confirm(`Remove ${S.plan[pi].name} from the plan?`)) { S.plan.splice(pi, 1); S.draft = S.draft && doneCount(S.draft) ? S.draft : null; save(); render(); } },
  async export() {
    const name = `gymlog-backup-${today()}.json`, blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  import() { $('#file').click(); },
  reset() { if (confirm('Erase every session, body entry and plan change on this device?') && confirm('This cannot be undone. Erase?')) { S = fresh(); commit(); render(); } },
};
function importData(obj) {
  if (obj && obj.format === 'gymlog-history' && Array.isArray(obj.sessions)) {
    const have = new Set(S.sessions.map(s => s.id)); let n = 0;
    for (const s of obj.sessions) if (!have.has(s.id)) { S.sessions.push(s); n++; }
    for (const [name, e] of Object.entries(obj.exercises || {})) if (!S.exercises[name]) S.exercises[name] = e;
    S.draft = S.draft && doneCount(S.draft) ? S.draft : null;
    commit(); return `Imported ${n} sessions.`;
  }
  if (obj && obj.v === 1 && Array.isArray(obj.sessions) && Array.isArray(obj.plan)) {
    if (S.sessions.length && !confirm(`Replace everything on this device with the backup (${obj.sessions.length} sessions)?`)) return null;
    S = obj; commit(); return `Restored ${obj.sessions.length} sessions.`;
  }
  throw new Error('Not a Gymlog file');
}
const CHG = {
  workout(el) {
    if (doneCount(S.draft) && !confirm('Switch workout and lose the sets ticked so far?')) { render(); return; }
    const pi = S.plan.findIndex(p => p.name === el.value); if (pi < 0) return;
    const date = S.draft.date, dateSet = S.draft.dateSet; S.draft = makeDraft(pi); S.draft.date = date; S.draft.dateSet = dateSet; save(); render();
  },
  date(el) { if (el.value) { S.draft.date = el.value; S.draft.dateSet = el.value !== today(); save(); } },
  detail(el) { ui.detail = el.value || null; render(); },
  plan(el) {
    const it = S.plan[+el.closest('[data-p]').dataset.p].items[+el.closest('[data-k]').dataset.k], v = parseInt(el.value, 10);
    if (v > 0) { it[el.dataset.f] = v; if (it.min > it.max) it.max = it.min; if (S.draft && !doneCount(S.draft)) S.draft = null; save(); }
    render();
  },
  setting(el) { const v = parseFloat(el.value); if (v > 0) { S.settings[el.dataset.f] = v; commit(); } render(); },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) { ACT[b.dataset.act](b); return; }
  const tip = e.target.closest('[data-tip]'); if (tip && $('#wtip')) $('#wtip').textContent = tip.dataset.tip;
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el) CHG[el.dataset.chg](el); });
document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]'); if (!el) return;
  const v = parseFloat(el.value.replace(',', '.'));
  setField(el, el.dataset.inp, isFinite(v) && v >= 0 ? num(v) : null);
});
document.addEventListener('focusin', e => { if (e.target.matches('[data-inp]')) e.target.select(); });
function probe(e) {                     // crosshair on the detail chart
  const svg = e.target.closest('svg.detail'); if (!svg || !detailPts.length) return;
  const x = e.clientX - svg.getBoundingClientRect().left;
  const q = detailPts.reduce((a, p) => Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a), info = exInfo(ui.detail);
  const xh = $('#xh', svg), xd = $('#xd', svg);
  xh.setAttribute('x1', q.x); xh.setAttribute('x2', q.x); xd.setAttribute('cx', q.x); xd.setAttribute('cy', q.y);
  $('#tip').textContent = `${fmtDate(q.p.date, true)} · ${fmtLoad(info, q.p.w, q.p.r)} · ${fmtVal(info, q.p.v)}`;
}
document.addEventListener('pointermove', probe);
document.addEventListener('pointerdown', probe);
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const msg = importData(JSON.parse(await f.text())); if (msg) { alert(msg); render(); } } catch (err) { alert('Could not import: ' + err.message); }
});
window.addEventListener('resize', () => { if (ui.tab === 'progress') render(); });

window.gymlog = { importData, state: () => S, render };     // for debugging from the console
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
