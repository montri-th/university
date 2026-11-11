/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search with a question written for the view: a campus (faculties, admission, fees this
 *    year, getting there, dormitories and what is round it), a university, a reporting unit, a station, a building of
 *    a campus, or the country/province overview (student numbers, trends, new campuses). Google answers at the top of
 *    the results (AI Overview) and its AI Mode tab carries the question on. Never a link straight into AI Mode
 *    (`udm=50`): Google stops one that comes from another site at “Continue with this search?” (Hotel 0.3.3, measured
 *    2026-11-02). Owner 2026-11-02: “ทำให้มันตอบทันเลยได้มั้ย”;
 *  - Street View — only where the view has a point (a site's reference point, or a station's, which is not an
 *    entrance: the label says “ใกล้”);
 *  - Google Maps — a search by the campus's name + district + province.
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). The Google names on the
 * buttons say where the answers come from (owner 2026-11-01: no caveat lines). An English page (citymeter-shell
 * 0.5.x) asks in English, with the English names the data gives (js/lang.js); the button labels are translated by
 * js/shell/i18n.js like the rest of the page.
 */
import {LANG, englishName, translate} from './shell/i18n.js';

const enc = encodeURIComponent;
export const googleAskURL = q => `https://www.google.com/search?q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').replace(/\s*\((?:ชื่อพื้นที่จาก OSM)\)\s*/g, ' ').trim();
const join = (...parts) => clean(parts.filter(Boolean).join(' '));
/**
 * ctx: {kind: 'site'|'uni'|'unit'|'building'|'station'|'overview', site?, uni?, unit?, area?: {place, province},
 *       station?, province?, point?: {lat, lon, role}}
 * → [{id, label, href, note}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}, lang = LANG) {
  if (lang === 'en') return contextActionsEnglish(ctx);
  const out = [];
  const add = (id, label, href, note = '') => { if (href) out.push({id, label, href, note}); };
  if (ctx.kind === 'site' && ctx.site) {
    const name = clean(ctx.site.name), where = join(ctx.area?.place, ctx.area?.province);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''} มีคณะอะไรบ้าง รับนักศึกษาปีนี้กี่คน ค่าเทอมเท่าไร เดินทางไปอย่างไร และรอบ ๆ มีหอพักและร้านค้าอะไรบ้าง`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'uni' && ctx.uni) {
    add('ai', 'ถาม Google AI', googleAskURL(`${clean(ctx.uni.name)} มีวิทยาเขตที่ไหนบ้าง นักศึกษาเพิ่มขึ้นหรือลดลง และมีแผนเปิดวิทยาเขตหรือหลักสูตรใหม่อะไรบ้าง`));
  } else if (ctx.kind === 'unit' && ctx.unit) {
    add('ai', 'ถาม Google AI', googleAskURL(`${clean(ctx.unit.name)} มีคณะและหลักสูตรอะไรบ้าง นักศึกษาส่วนใหญ่เรียนที่วิทยาเขตไหน และค่าเทอมเท่าไร`));
  } else if (ctx.kind === 'building' && ctx.site) {
    add('ai', 'ถาม Google AI', googleAskURL(`อาคารคณะต่าง ๆ ใน${clean(ctx.site.name)} อยู่ตรงไหน และเดินทางเข้าออกทางไหนสะดวก`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, line = (s.lines || []).join(' ');
    add('ai', 'ถาม Google AI', googleAskURL(`มหาวิทยาลัยใกล้สถานี${clean(s.name)}${line ? ` (${clean(line)})` : ''} มีที่ไหนบ้าง เดินไปกี่นาที และรอบสถานีมีหอพักนักศึกษามากไหม`));
    add('maps', 'Google Maps', mapsSearchURL(`มหาวิทยาลัยใกล้สถานี${clean(s.name)}`));
  } else if (ctx.kind === 'overview') {
    const where = clean(ctx.province) || 'ประเทศไทย';
    add('ai', 'ถาม Google AI', googleAskURL(`ภาพรวมจำนวนนักศึกษามหาวิทยาลัยใน${where}ล่าสุด เพิ่มขึ้นหรือลดลง มหาวิทยาลัยไหนใหญ่ที่สุด และมีวิทยาเขตเปิดใหม่หรือปิดที่ไหนบ้าง`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  }
  return out;
}

/** The same actions for an English page: English questions, English names where the data has them. */
function contextActionsEnglish(ctx = {}) {
  // N: a name (the data's English, else as given); T: a word of the dictionary (a line), else as given.
  const out = [], N = s => englishName(clean(s)), T = s => translate(clean(s)) ?? clean(s);
  const add = (id, label, href) => { if (href) out.push({id, label, href, note: ''}); };
  const where = ctx.area ? [N(ctx.area.place), N(ctx.area.province)].filter(Boolean).join(', ') : '';
  const lines = s => (s.lines || []).map(T).join(', ');
  if (ctx.kind === 'site' && ctx.site) {
    const name = N(ctx.site.name);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''}, Thailand: which faculties are there, how many students does it admit this year, what are the fees, how do I get there, and what housing and shops are around it?`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, N(ctx.area?.place), N(ctx.area?.province))));
  } else if (ctx.kind === 'uni' && ctx.uni) {
    add('ai', 'ถาม Google AI', googleAskURL(`${N(ctx.uni.name)} (Thailand): where are its campuses, are student numbers rising or falling, and what new campuses or programmes are planned?`));
  } else if (ctx.kind === 'unit' && ctx.unit) {
    add('ai', 'ถาม Google AI', googleAskURL(`${N(ctx.unit.name)} (Thailand): which faculties and programmes does it have, at which campus do most students study, and what are the fees?`));
  } else if (ctx.kind === 'building' && ctx.site) {
    add('ai', 'ถาม Google AI', googleAskURL(`Where are the faculty buildings of ${N(ctx.site.name)} (Thailand), and which gates are easiest to use?`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, station = N(s.name), line = lines(s);
    add('ai', 'ถาม Google AI', googleAskURL(`Universities near ${station} station${line ? ` (${line})` : ''}, Thailand: which are they, how many minutes' walk, and is there much student housing round the station?`));
    add('maps', 'Google Maps', mapsSearchURL(`university near ${station} station`));
  } else if (ctx.kind === 'overview') {
    const place = N(ctx.province) || 'Thailand';
    add('ai', 'ถาม Google AI', googleAskURL(`Latest overview of university students in ${place}: are numbers rising or falling, which universities are largest, and where have campuses opened or closed?`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"${a.note ? ` title="${esc(a.note)}"` : ''}><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}</div>`;
}
