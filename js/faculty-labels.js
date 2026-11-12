/**
 * Faculty names on the map: the located faculties of the open campus at their places (owner 2026-11-12 11:12,
 * VERBATIM: “และถ้ามีตำแหน่งคณะในแผนที่แล้วน่าจะโชว์ป้ายด้วย”, for every campus: “apply ทุกมหาลัยได้มั้ย”).
 *
 * A faculty's place is the first of its geometries (31_DEMO_UNIT_SITES → 30_DEMO_GEOMETRY, js/campus.js) in this order:
 * a reference point, the interior point of a building footprint or shared building, the interior point of a mapped area
 * (`pt`, written by scripts/build-data.py). Faculties at one place share one label: the first name and “+N”. A label is
 * the faculty pictogram and the name without a leading “คณะ” (the pictogram says it), the full names in its title; ranked
 * by the faculty's students in the student file (the largest of a shared label; none after), then by name. From
 * FACULTY_LABEL_MIN_ZOOM, as many as fit in the visible map without covering one another, a faculty's dot, the open
 * campus's pin, the map chrome or a popup, at most FACULTY_LABEL_MAX (desktop / phone). Placed before the campus labels
 * (js/labels.js), which avoid them. They follow their points during a camera move and are placed again when it ends.
 * A label is not a control: the panel lists the same faculties with their figures, and a click passes through to the
 * building under it. A place is evidence of where a faculty is, never its whole territory, an entrance or a floor.
 */
import {placeLabels} from './labels.js';
import {LANG} from './shell/i18n.js';

export const FACULTY_LABEL_MIN_ZOOM = 13;
export const FACULTY_LABEL_MAX = Object.freeze({desktop: 20, phone: 8});
/** Half-size (px) of a faculty dot that no other label may cover. */
const DOT_PX = 5;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const THAI = /[ก-ฺเ-๎]/;
const LEAD = /^คณะ\s*/;
const COLLATOR = new Intl.Collator('th');

/** Pure: the label's name — a leading “คณะ” dropped (never shorter than 3 characters). */
export function shortFacultyName(name) {
  const original = String(name ?? '').trim();
  const short = original.replace(LEAD, '').trim();
  return short.length >= 3 ? short : original;
}

const finitePair = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** Pure: a faculty's place [lon, lat] from its geometries ({role, g, pt}), or null without one. */
export function facultyPlace(f) {
  const list = f?.geometry || [];
  const point = list.find(g => g?.role === 'point' && g.g?.type === 'Point' && finitePair(g.g.coordinates));
  if (point) return point.g.coordinates.slice(0, 2);
  const building = list.find(g => (g?.role === 'building' || g?.role === 'shared') && finitePair(g.pt));
  if (building) return building.pt.slice(0, 2);
  const area = list.find(g => g?.role === 'area' && finitePair(g.pt));
  return area ? area.pt.slice(0, 2) : null;
}

const byStudents = (a, b) => (b.students ?? -1) - (a.students ?? -1) || COLLATOR.compare(String(a.name), String(b.name));

/**
 * Pure: the labels of a campus's faculties (js/profile-model.js#facultiesOf: [{name, students, geometry}]) —
 * [{id, longitude, latitude, name, short, more, names, students}], one per place, ranked.
 */
export function facultyLabelRows(faculties) {
  const at = new Map();
  for (const f of faculties || []) {
    const p = facultyPlace(f);
    if (!p) continue;
    const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    let group = at.get(key);
    if (!group) at.set(key, group = {key, p, list: []});
    group.list.push(f);
  }
  return [...at.values()].map(({key, p, list}) => {
    const sorted = [...list].sort(byStudents);
    const first = sorted[0];
    return {id: `faculty:${key}`, longitude: p[0], latitude: p[1], name: first.name, short: shortFacultyName(first.name),
      more: sorted.length - 1, names: sorted.map(f => f.name), students: Number.isFinite(first.students) ? first.students : null};
  }).sort(byStudents);
}

/**
 * Mount on a MapLibre map and its container. options: bounds() → {left, right, top, bottom, exclusions} (js/pins.js) ·
 * avoid() → extra boxes (the open campus's pin) · isPhone().
 * Returns {update(rows), layout, boxes() → placed boxes (for the campus labels to avoid), refresh, dispose}.
 */
export function installFacultyLabels(map, container, {bounds, avoid = () => [], isPhone = () => false} = {}) {
  const host = document.createElement('div');
  host.className = 'faculty-labels';
  // Names from the data (never translated); the panel's faculty list says the same to assistive technology.
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('translate', 'no');
  container.append(host);
  let rows = [], placed = [], frame = 0, timer = 0, moving = false;
  const pool = new Map(); // id → {el, w, h}

  function element(row) {
    let e = pool.get(row.id);
    if (e) return e;
    const el = document.createElement('span');
    el.className = 'faculty-label';
    el.title = row.names.join(' · ');
    const lang = LANG === 'en' && THAI.test(row.short) ? ' lang="th"' : '';
    el.innerHTML = `<i class="pictogram pic-classroom" aria-hidden="true"></i><span class="fl-name"${lang}>${esc(row.short)}</span>${row.more ? `<span class="fl-more">+${row.more}</span>` : ''}`;
    el.hidden = true;
    host.append(el);
    e = {el, w: 0, h: 0};
    pool.set(row.id, e);
    return e;
  }
  const measure = row => { const e = element(row); if (!e.w) { e.el.hidden = false; e.el.style.transform = 'translate(-9999px, -9999px)'; e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; } return {w: e.w, h: e.h}; };
  const popups = () => {
    const c = container.getBoundingClientRect();
    return [...container.querySelectorAll('.maplibregl-popup')].map(el => { const r = el.getBoundingClientRect(); return {left: r.left - c.left - 4, right: r.right - c.left + 4, top: r.top - c.top - 4, bottom: r.bottom - c.top + 4}; });
  };

  function layout() {
    frame = 0;
    const b = bounds();
    let next = [];
    if (rows.length && map.getZoom() >= FACULTY_LABEL_MIN_ZOOM) {
      const cands = [];
      for (const row of rows) {
        const p = map.project([row.longitude, row.latitude]);
        if (p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom) cands.push({row, x: p.x, y: p.y});
      }
      const dots = cands.map(c => ({left: c.x - DOT_PX, right: c.x + DOT_PX, top: c.y - DOT_PX, bottom: c.y + DOT_PX}));
      next = placeLabels(cands, measure, () => 3, b, {max: isPhone() ? FACULTY_LABEL_MAX.phone : FACULTY_LABEL_MAX.desktop, blockers: [...(b.exclusions || []), ...popups(), ...avoid(), ...dots]});
    }
    const keep = new Set(next.map(p => p.row.id));
    for (const [id, e] of pool) if (!keep.has(id)) { e.el.hidden = true; e.el.classList.remove('is-on'); }
    for (const p of next) {
      const e = element(p.row);
      e.el.hidden = false;
      e.el.classList.toggle('is-below', p.below);
      e.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      requestAnimationFrame(() => e.el.classList.add('is-on'));
    }
    placed = next.map(p => ({...p, dx: p.x - p.ax, dy: p.y - p.ay}));
  }
  /** Follow the points during a move: same set, same offsets, new anchors. */
  function follow() {
    frame = 0;
    const b = bounds();
    for (const p of placed) {
      const e = pool.get(p.row.id);
      if (!e) continue;
      const a = map.project([p.row.longitude, p.row.latitude]);
      const x = Math.round(a.x + p.dx), y = Math.round(a.y + p.dy);
      const off = x < b.left - 40 || x > b.right + 40 || y < b.top - 30 || y > b.bottom + 30;
      e.el.hidden = off;
      if (!off) e.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  const schedule = () => { if (frame) return; frame = requestAnimationFrame(() => (moving ? follow() : layout())); };
  // One frame after the change: the campus labels wait two (js/labels.js) and read these boxes.
  const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
  const onMove = () => { moving = true; schedule(); clearTimeout(timer); timer = setTimeout(() => { moving = false; soon(); }, 260); };
  const onMoveEnd = () => { clearTimeout(timer); moving = false; soon(); };
  map.on('move', onMove);
  map.on('moveend', onMoveEnd);
  map.on('resize', schedule);
  const onFonts = () => { for (const e of pool.values()) e.w = 0; schedule(); };
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  return {
    update(list) {
      const next = list || [];
      if (next.length !== rows.length || next.some((r, i) => r.id !== rows[i]?.id)) {
        for (const e of pool.values()) e.el.remove();
        pool.clear(); placed = [];
      }
      rows = next;
      soon();
    },
    layout: soon,
    /** The placed labels' boxes in container pixels (the campus labels keep clear of them). */
    boxes: () => placed.map(p => p.box),
    refresh() { for (const e of pool.values()) e.el.remove(); pool.clear(); placed = []; soon(); },
    dispose() { cancelAnimationFrame(frame); clearTimeout(timer); map.off('move', onMove); map.off('moveend', onMoveEnd); map.off('resize', schedule); document.fonts?.removeEventListener?.('loadingdone', onFonts); host.remove(); pool.clear(); },
  };
}
