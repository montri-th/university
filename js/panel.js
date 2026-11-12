/**
 * Reading panel views as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); the app binds one delegated handler.
 * Actions: select-site · select-uni · select-unit · select-station · select-building · select-province · filter-type ·
 * set-metric · back · explore-top · clear-focus · open-charts · open-table · clear-filter · leave-province.
 *
 * Copy (the Hotel rule of 2026-11-01, “เรื่องภาษา ขอที่ กระชับอ่านเข้าใจง่าย ใช้ symbol, logo, icon, charts มาช่วยทำให้
 * text กระชับ … ตรงกับ context ของ ICP ตาม product statement ไม่มี caveats เลย และเป็นธรรมชาติ”): short Thai in the words
 * of people choosing land near a campus — นักศึกษา / มหาวิทยาลัย / วิทยาเขต / คณะ / หน่วยรายงาน / จังหวัด / สถานี /
 * ค่าธรรมเนียม; pictograms, logos and small bar charts carry what a sentence used to; no caveat on screen. Exactness comes
 * from the names themselves — “นักศึกษาตามหน่วยรายงาน …”, “ค่าธรรมเนียม … ต่อภาค … ปีการศึกษา …” as the university
 * wrote it, a rank “จาก N”, the numerator and denominator of every share (visible, or in the tile's title and accessible
 * name) — and from one provenance line per view: dataset · source · date · boundary, then “วิธีนับ” (DATA_METHOD.md, where
 * the method and its limits live). Two measures (js/model.js#METRICS): นักศึกษา (default) · หน่วยรายงาน. A site's students
 * are always its unit's figure, named as such; a faculty's its academic unit's. Fees are one programme's lines as
 * published, never summed or averaged. Distances are straight lines (the distance pictogram; “ระยะตรง” in titles).
 * Sources, methods and ids sit in one closed <details>.
 */
import {LANG} from './shell/i18n.js';
import {provinceByCode, hasPoint, stationLink, retailLink, LEVELS, LINKS, COORD_TH, TYPE_SHORT, feeWord, cohortWords, money} from './model.js';
import {areaWord} from './areas.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const num = n => NUMBER.format(n);
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; } };
/** Straight-line distance for display: "320 ม." / "1.4 กม.". */
export const meters = m => (!Number.isFinite(m) ? '' : m < 1000 ? `${num(Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toLocaleString('th-TH', {maximumFractionDigits: 1})} กม.`);
/** A decorative pictogram of the approved subset (js/navigation.js PICTOGRAM_CONTRACT); the text carries the meaning. */
const pic = (kind, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(kind)}" aria-hidden="true"></i>`;
/** The method and its limits (one link at the end of every provenance line). */
export const METHOD_URL = 'DATA_METHOD.md';

export function link(url, label, cls = 'source-link') {
  const u = safeURL(url);
  return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

export function thaiDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** Metric tile with a decorative pictogram; value may be a preformatted string. `detail` (numerator and denominator)
 *  is the tile's title and part of its accessible text. */
export function metricTile(value, label, kind = '', detail = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"${detail ? ` title="${esc(detail)}"` : ''}>${pic(kind || 'plain', 'metric-symbol')}<strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span>${detail ? `<span class="sr-only">${esc(detail)}</span>` : ''}</div>`;
}
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}>${pic(kind)}${esc(text)}</h3>`;

const provinceName = code => provinceByCode(code)?.th || code || '';
const valueText = (v, unit) => nw(`<strong class="data-number">${num(v)}</strong> ${esc(unit.one)}`);
/** "อโศก (สุขุมวิท)" — next to the rail pictogram; "สถานีอโศก (สุขุมวิท)" in running text. */
const stationShort = s => (s ? `${s.name}${s.lines?.length ? ` (${s.lines.join(' · ')})` : ''}` : '');
/** "เขตจตุจักร" / "อำเภอเมืองเชียงใหม่" for a site's point (index record), '' without one. */
export const districtName = (a, province) => (a ? `${areaWord(province || a.province)}${a.name}` : '');
/** A university's name is said once: a site whose name begins with it does not repeat it. */
const uniLine = s => (s.uni && !String(s.name || '').startsWith(s.uni.name) ? s.uni.name : '');
const typeName = t => t?.th || '';

/* ---------- provenance ---------- */

/**
 * The provenance line every view that shows numbers ends with: dataset · source · date · boundary (each part in
 * `data-prov`, its word for screen readers), then the method link. The 2566 roster, OpenStreetMap, the universities'
 * own pages, rail and terrain join the source part when the view shows them.
 */
export function provenance(ctx = {}, boundary = '', {students = true, roster = false, osm = false, official = false, rail = false, terrain = false} = {}) {
  const meta = ctx.meta || {};
  const sources = [students ? `แฟ้มนักศึกษา อว. ${meta.period?.label || '2568/2'}` : '', roster ? 'ทะเบียนสถานศึกษา อว. 2566' : '',
    official ? 'เว็บไซต์มหาวิทยาลัย' : '', osm ? 'OpenStreetMap' : '',
    rail ? `CityMETER Transit ${thaiDate(meta.context?.rail?.asOf || '')}`.trim() : '',
    terrain ? `SRTM 30 ม. (2543)${ctx.osmDate ? ` · OSM ${thaiDate(ctx.osmDate)}` : ''}` : ''].filter(Boolean);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">ชุดข้อมูล </span>CityMETER University</span> <span class="prov-part" data-prov="source"><span class="sr-only">แหล่ง</span>จาก ${esc(sources.join(' · '))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">ตรวจ </span>${esc(thaiDate(meta.checkedOn || ''))}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">ขอบเขต </span>${esc(boundary)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}" target="_blank" rel="noopener">วิธีนับ</a></span></p>`;
}

/* ---------- shared fragments ---------- */

/** Bars per institution type in the type's series colour + shape cue; value = the measure; each filters to that type. */
function typeBars(types, unit) {
  const list = types.filter(t => t.value > 0).sort((a, b) => b.value - a.value || a.index - b.index);
  if (!list.length) return `<p class="hint">ไม่มี${esc(unit.subject)}</p>`;
  const max = Math.max(1, ...list.map(t => t.value));
  return `<ul class="mix-list" aria-label="ประเภทสถาบัน (${esc(unit.one)})">${list.map(t => `
    <li><button type="button" class="mix-row" data-action="filter-type" data-value="${esc(t.id)}" title="${esc(t.th)} · ${num(t.students)} คน · ${num(t.count)} หน่วยรายงาน (ดูเฉพาะประเภทนี้)"><span class="mix-label">${cueMarkup(t.series)}${esc(t.short || t.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${t.series}" style="width:${Math.max(3, Math.round((t.value / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(t.value)}</span></button></li>`).join('')}</ul>`;
}

/** Students per level of the student file (ป.ตรี · ป.โท · ป.เอก · อื่น ๆ); the share of the total in each title. */
function levelBars(levels) {
  const list = LEVELS.map(l => ({...l, value: levels[l.id] || 0})).filter(l => l.value > 0);
  if (!list.length) return '';
  const max = Math.max(1, ...list.map(l => l.value));
  return `<ul class="mix-list level-list" aria-label="นักศึกษาตามระดับ (คน)">${list.map(l => `
    <li title="${esc(l.title)} · ${num(l.value)} จาก ${num(levels.total)} คน"><span class="mix-label">${esc(l.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${Math.max(3, Math.round((l.value / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(l.value)}</span><span class="sr-only">${esc(pct(l.value, levels.total))}</span></li>`).join('')}</ul>`;
}

/** Sites: cue (type) + name, then university · place · faculties · distance. */
export function siteList(sites, {distance = null, showProvince = false, index = null} = {}) {
  return `<ul class="outlet-list">${sites.map(s => {
    const d = distance?.get?.(s.id);
    const area = index && s.district ? index.byId.get(s.district) : null;
    const meta = [uniLine(s), area ? districtName(area, s.province) : '', showProvince ? provinceName(s.province) : '',
      s.faculties ? `${num(s.faculties)} คณะ` : '', s.unit ? `${num(s.unit.students)} คนตามหน่วยรายงาน` : '', Number.isFinite(d) ? meters(d) : ''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="brand-row" data-action="select-site" data-id="${esc(s.id)}">${cueMarkup(s.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(s.name)}</strong><span class="row-meta">${esc(meta)}</span></span></button></li>`;
  }).join('')}</ul>`;
}

/** Reporting units: cue (type) + name, then students · province. */
export function unitList(units, {showProvince = true, showUni = false} = {}) {
  return `<ul class="outlet-list">${units.map(u => {
    const meta = [`${num(u.students)} คน`, showUni && u.uni.name !== u.name ? u.uni.name : '', showProvince ? provinceName(u.province) : '', u.site ? 'อยู่บนแผนที่' : ''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="brand-row" data-action="select-unit" data-id="${esc(u.id)}">${cueMarkup(u.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(u.name)}</strong><span class="row-meta">${esc(meta)}</span></span></button></li>`;
  }).join('')}</ul>`;
}

/** "ดูทั้งหมด 193 หน่วย" under a shortened list (opens the table). */
const moreButton = (count, one = 'หน่วย') => `<p class="list-more"><button type="button" class="link-button" data-action="open-table">ดูทั้งหมด ${num(count)} ${esc(one)}</button></p>`;

/** Ranked rows with a bar (provinces in their ramp colour, universities in their type colour). */
function rankRows(list, unit, {action, label, sub = () => '', fill = () => '', limit = 10}) {
  const top = list.filter(x => x.value > 0).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(x => x.value));
  return `<ol class="rank-list">${top.map((x, i) => `<li><button type="button" class="rank-row" data-action="${esc(action)}" data-id="${esc(x.id)}" aria-label="อันดับ ${i + 1} ${esc(label(x))} ${num(x.value)} ${esc(unit.one)} ${esc(sub(x))}">
      <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
      <span class="rank-name">${esc(label(x))}<small>${esc(sub(x))}</small></span>
      <span class="rank-track" aria-hidden="true"><span class="rank-fill${fill(x) ? '' : ' size-fill'}" style="width:${Math.max(3, Math.round((x.value / max) * 100))}%${fill(x) ? `;background:${esc(fill(x))}` : ''}"></span></span>
      <span class="rank-value data-number" aria-hidden="true">${num(x.value)}</span></button></li>`).join('')}</ol>`;
}

/** The other figure of a ranked row: units under the students measure, students under the units measure. */
const otherOf = (x, unit) => (unit.id === 'units' ? `${num(x.students)} คน` : `${num(x.count)} หน่วยรายงาน`);

/* ---------- Aha ---------- */

/** The open-admission comparison as two bars: the same provinces' share with and without them (bases in each title). */
function openCompare(insight, unit) {
  const c = insight.comparison;
  if (!c || unit.id !== 'students' || !insight.items.length) return '';
  const detail = (v, t, what) => `${num(v)} จาก ${num(t)} คน${what}`;
  const bar = (label, v, t, what) => `<li title="${esc(detail(v, t, what))}"><span class="mix-label">${esc(label)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${Math.max(2, Math.round((v / t) * 100))}%"></span></span>
      <span class="mix-value data-number">${pct(v, t)}</span><span class="sr-only">${esc(detail(v, t, what))}</span></li>`;
  const names = c.excluded.map(n => n.replace(/^มหาวิทยาลัย/, '')).join(' · ');
  return `<div class="aha-rail"><p class="aha-rail-title">${pic('compare')}ไม่นับมหาวิทยาลัยเปิด (${esc(names)})</p>
    <ul class="mix-list rail-compare">${bar('ทุกประเภท', insight.value, insight.total, ' ในจังหวัดเหล่านี้')}${bar('ไม่นับมหาวิทยาลัยเปิด', c.value, c.total, ' ในจังหวัดเหล่านี้ ไม่นับมหาวิทยาลัยรัฐไม่จำกัดรับ')}</ul></div>`;
}

/** Provinces where no unit of the file reports (measured zero of this file under the filters). */
function zeroLine(insight) {
  if (!insight.zero?.length) return '';
  const names = insight.zero.map(c => `<button type="button" class="link-button" data-action="select-province" data-id="${esc(c)}">${esc(provinceName(c))}</button>`).join(' · ');
  return `<p class="aha-secondary" title="ไม่มีหน่วยรายงานในแฟ้มนักศึกษา อว. ระบุจังหวัดเหล่านี้ (ตามตัวกรอง)">${pic('province')}${nw(`ไม่มีหน่วยรายงาน ${num(insight.zero.length)} จังหวัด`)}: ${names}</p>`;
}

/** The Aha block of the overview (any measure): the finding, its numerator and denominator. */
export function ahaBlock({insight, summary, focusMode = 'auto', unit, province = ''}) {
  if (!summary.count) {
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2>ไม่พบหน่วยรายงานตามตัวกรองนี้</h2>
      <div class="aha-actions"><button type="button" data-action="clear-filter" data-id="all" class="btn">ล้างตัวกรอง</button>${province ? '<button type="button" class="btn quiet" data-action="leave-province">ดูทั้งประเทศ</button>' : ''}</div></section>`;
  }
  const items = insight.items || [];
  if (!items.length) {
    const where = province ? provinceName(province) : 'ประเทศไทย';
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${num(summary.students)}</span><span class="aha-headline">คน ใน${esc(where)} · ${num(summary.count)} หน่วยรายงาน</span></h2>
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบ</button></div></section>`;
  }
  if (insight.mode === 'province') {
    const names = items.map(x => `<button type="button" class="link-button" data-action="select-uni" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join(' · ');
    const word = items.length === 1 ? 'มหาวิทยาลัยนี้' : `${num(items.length)} มหาวิทยาลัยนี้`;
    return `<section class="aha is-auto" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${pct(insight.value, insight.total)}</span><span class="aha-headline">ของ${esc(unit.subject)}ใน${esc(provinceName(province))} อยู่กับ ${nw(esc(word))}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.value)}</strong> จาก ${num(insight.total)} ${esc(unit.one)}`)}</p>
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet" data-value="unis">เปรียบเทียบมหาวิทยาลัย</button></div></section>`;
  }
  const names = items.map(p => `<button type="button" class="link-button" data-action="select-province" data-id="${esc(p.code)}">${esc(p.name)}</button>`).join(' · ');
  const toggle = focusMode === 'auto'
    ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกจังหวัดเท่ากัน</button>'
    : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(items.length)} จังหวัดนี้</button>`;
  return `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${pct(insight.value, insight.total)}</span><span class="aha-headline">ของ${esc(unit.subject)}ทั้งประเทศ อยู่ใน ${nw(`${num(items.length)} จังหวัดนี้`)}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.value)}</strong> จาก ${num(insight.total)} ${esc(unit.one)}`)}</p>
      ${openCompare(insight, unit)}${zeroLine(insight)}
      <div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบจังหวัด</button></div></section>`;
}

/* ---------- Overview ---------- */

/** Provinces ranked by the measure (the national overview), in the map's ramp colour. */
function provinceBlock(provinces, unit, fillOf) {
  if (provinces.length < 2) return '';
  const row = p => `<li><button type="button" class="province-row" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(p.name)} ${num(p.value)} ${esc(unit.one)} กดเพื่อดูจังหวัด"><i class="province-swatch" style="background:${esc(fillOf(p.code))}" aria-hidden="true"></i><span class="province-name">${esc(p.name)}</span><span class="province-count data-number">${num(p.value)}<small>${esc(unit.one)}</small></span></button></li>`;
  const shown = provinces.slice(0, 8), rest = provinces.slice(8);
  return `<section class="panel-section" aria-labelledby="province-title">
    <div class="section-heading">${heading('province', `จังหวัดที่มี${unit.subject}มากที่สุด`, 'province-title')}<span class="hint">${num(provinces.length)} จังหวัด</span></div>
    <ul class="province-list">${shown.map(row).join('')}</ul>
    ${rest.length ? `<details class="more-provinces"><summary>อีก ${num(rest.length)} จังหวัด</summary><ul class="province-list">${rest.map(row).join('')}</ul></details>` : ''}</section>`;
}

/** The sites on the map in a line of chips: how many, with an extent, with faculties, near rail. */
function siteFacts(s, province) {
  if (!s.count) return '';
  const chip = (kind, text, title) => `<span class="fact-chip" title="${esc(title)}">${pic(kind)}${text}</span>`;
  return `<div class="fact-chips">${chip('maps', nw(`${num(s.located)} แห่งบนแผนที่`), `พื้นที่มหาวิทยาลัยที่ทีมวิจัยตรวจแล้ว${province ? 'ในจังหวัดนี้' : ''} · ${num(s.count)} แห่ง มีจุด ${num(s.located)} แห่ง`)}
    ${s.extents ? chip('area', nw(`${num(s.extents)} มีกรอบพื้นที่`), 'กรอบพื้นที่โดยประมาณจาก OpenStreetMap') : ''}
    ${s.faculties ? chip('classroom', nw(`${num(s.faculties)} มีรายชื่อคณะ`), 'พื้นที่ที่ทีมวิจัยพบหลักฐานว่ามีคณะใดอยู่') : ''}
    ${s.rail ? chip('rail', nw(`${num(s.rail)} ใกล้รถไฟฟ้า ≤ 1 กม.`), 'จุดของพื้นที่ห่างสถานีที่เปิดแล้วไม่เกิน 1 กม. (ระยะตรง)') : ''}</div>`;
}

/** Stations of CityMETER · Transit with the most sites within 1 km. */
function stationBlock(list) {
  if (!list?.length) return '';
  return `<section class="panel-section"><div class="section-heading">${heading('rail', 'สถานีใกล้วิทยาเขต')}<span class="hint" title="ระยะตรงจากสถานีที่เปิดแล้ว">${pic('distance', 'hint-pic')}≤ 1 กม.</span></div>
    <ol class="rank-list">${list.map((x, i) => `<li><button type="button" class="rank-row" data-action="select-station" data-id="${esc(x.station.id)}" aria-label="สถานี${esc(stationShort(x.station))} ${num(x.count)} แห่ง">
      <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
      <span class="rank-name">${esc(stationShort(x.station))}<small>${esc(x.sites.slice(0, 2).map(s => s.name).join(' · '))}</small></span>
      <span class="rank-value data-number" aria-hidden="true">${num(x.count)}</span></button></li>`).join('')}</ol></section>`;
}

/**
 * The overview of Thailand or of the province of the จังหวัด filter. focusMode: 'auto' (the Aha's provinces carry the
 * focus stroke) · 'none' (every province alike).
 */
export function renderOverview({insight, overview, focusMode = 'auto', fillOf = () => '', ctx = {}}) {
  const unit = ctx.unit, s = overview.summary, province = overview.province;
  const aha = ahaBlock({insight, summary: s, focusMode, unit, province});
  const share = province && insight.nationalTotal ? metricTile(pct(insight.total, insight.nationalTotal), 'ของประเทศ', 'compare', `${num(insight.total)} จาก ${num(insight.nationalTotal)} ${unit.one}`) : '';
  const metrics = `<section class="metrics" aria-label="ตัวเลขรวมของข้อมูลที่เลือก">
    ${metricTile(s.students, 'นักศึกษา', 'students', `นักศึกษาตามแฟ้ม อว. ${ctx.meta?.period?.label || ''}`)}
    ${metricTile(s.count, 'หน่วยรายงาน', 'aff')}
    ${metricTile(s.universities, 'มหาวิทยาลัย', 'school')}
    ${province ? share : metricTile(s.provinces, 'จังหวัด', 'province')}
  </section>`;
  const rank = province && overview.rank ? `<p class="rank-line">${pic('rank')}อันดับ ${num(overview.rank.rank)} จาก ${num(overview.rank.of)} จังหวัดที่มีหน่วยรายงาน</p>` : '';
  const types = s.count ? `<section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภทสถาบัน')}<span class="hint">${esc(unit.one)}</span></div>${typeBars(overview.types, unit)}</section>` : '';
  const levels = s.students ? `<section class="panel-section"><div class="section-heading">${heading('level', 'ระดับ')}<span class="hint">คน</span></div>${levelBars(overview.levels)}</section>` : '';
  let ranking = '';
  if (!province) ranking = provinceBlock(overview.provinces || [], unit, fillOf);
  else if (overview.universities?.length) {
    ranking = `<section class="panel-section"><div class="section-heading">${heading('school', `มหาวิทยาลัยที่มี${unit.subject}มากที่สุด`)}<span class="hint" data-count="universities">${num(overview.universities.length)} แห่ง</span></div>
      ${rankRows(overview.universities, unit, {action: 'select-uni', label: x => x.name, sub: x => [x.type?.short, otherOf(x, unit)].filter(Boolean).join(' · '), limit: 10})}</section>`;
  }
  const sitesHere = province && overview.sitesList?.length
    ? `<section class="panel-section"><div class="section-heading">${heading('maps', 'วิทยาเขตบนแผนที่')}<span class="hint">${num(overview.sitesList.length)} แห่ง</span></div>${siteList(overview.sitesList.slice(0, 20), {index: ctx.index})}
      ${overview.sitesList.length > 20 ? `<p class="hint">อีก ${num(overview.sitesList.length - 20)} แห่งบนแผนที่</p>` : ''}</section>` : '';
  const place = province ? provinceName(province) : 'ประเทศไทย';
  return `${aha}${metrics}${rank}${siteFacts(overview.sites, province)}${ranking}${types}${levels}${sitesHere}${stationBlock(overview.stations)}
    ${actionBar({kind: 'overview', province: province ? place : ''})}
    ${provenance(ctx, `${place} · จังหวัดตามหน่วยรายงาน`, {roster: overview.sites.count > 0, rail: overview.stations?.length > 0})}`;
}

/* ---------- Site ---------- */

/** A university logo on a plate of the surface it was drawn for (LOGO_LIBRARY.recommended_surface), never recoloured. */
function logoMark(logo, name) {
  if (!logo?.file) return '';
  const w = Number(logo.w) || 0, h = Number(logo.h) || 0;
  const size = w && h ? ` width="${Math.round(Math.min(112, (w / h) * 32))}" height="32"` : '';
  return `<span class="logo-plate is-${logo.surface === 'dark' ? 'dark' : 'light'}"><img src="${esc(logo.file)}" alt="โลโก้ ${esc(name)}"${size} loading="lazy" decoding="async"></span>`;
}

/** The linked unit's figure, named as the unit's (DATA_METHOD.md §4). */
function unitTile(site) {
  const u = site.unit;
  if (!u) return '';
  const how = LINKS[site.link] || LINKS.name;
  return `<button type="button" class="unit-card" data-action="select-unit" data-id="${esc(u.id)}" title="${esc(how.title)}">
    <span class="unit-card-head">${pic('students')}<strong class="data-number">${num(u.students)}</strong> <span>คน</span></span>
    <span class="unit-card-label">นักศึกษาตาม${esc(how.th)}</span>
    <span class="unit-card-name">${esc(u.name)} · ${esc(provinceName(u.province))}</span></button>`;
}

/** Faculties of the site (31_DEMO_UNIT_SITES) with their academic unit's students (02, same file) and their geometry. */
function facultySection(d) {
  if (d.faculties === null) return d.site.faculties ? `<section class="panel-section"><div class="section-heading">${heading('classroom', 'คณะในพื้นที่นี้')}</div><p class="hint">กำลังโหลดรายชื่อคณะ</p></section>` : '';
  if (!d.faculties.length) return '';
  const geomWord = f => {
    const roles = new Set(f.geometry.map(g => g.role));
    return roles.has('building') || roles.has('shared') ? 'มีอาคารบนแผนที่' : roles.has('area') ? 'มีพื้นที่บนแผนที่' : roles.has('point') ? 'มีจุดบนแผนที่' : '';
  };
  const rows = d.faculties.map(f => `<li><span class="faculty-row"><span class="row-text"><strong>${esc(f.name)}</strong><span class="row-meta">${esc([Number.isFinite(f.students) ? `${num(f.students)} คนตามหน่วยรายงาน` : '', geomWord(f)].filter(Boolean).join(' · '))}</span></span>${f.info ? link(f.info, 'เว็บคณะ', 'source-link row-link') : ''}</span></li>`).join('');
  return `<section class="panel-section"><div class="section-heading">${heading('classroom', 'คณะในพื้นที่นี้')}<span class="hint" title="นักศึกษาของคณะตามแฟ้ม อว. ของหน่วยรายงาน">${num(d.faculties.length)} คณะ</span></div>
    <ul class="outlet-list faculty-list">${rows}</ul></section>`;
}

/** One fee line as the university wrote it: amount · component · period · who · cohort. */
function feeLine(f) {
  const scope = [feeWord('type', f.type), feeWord('component', f.component), feeWord('period', f.period)].filter(Boolean).join(' · ');
  const intake = cohortWords(f.cohort);
  const note = [feeWord('category', f.category), intake || (f.year ? `ปีการศึกษา ${f.year}` : ''),
    f.estimate === 'official_estimate' ? 'ประมาณการของมหาวิทยาลัย' : '',
    f.selection === 'verified_component_included_in_total_do_not_add_again' ? 'รวมอยู่ในยอดรวมแล้ว' : ''].filter(Boolean).join(' · ');
  return `<li><span class="fee-scope">${esc(scope)}${note ? `<span class="fee-note hint">${esc(note)}</span>` : ''}</span><span class="fee-value data-number">${esc(money(f.amount, f.currency))}</span></li>`;
}

/** Programmes and their published fees (32 → 33), by the source's faculty label; every line verbatim, never summed. */
function offeringSection(d) {
  if (d.offerings === null || !d.offerings.length) return '';
  const total = d.offerings.reduce((n, g) => n + g.offerings.length, 0);
  const withFees = d.offerings.reduce((n, g) => n + g.offerings.filter(o => o.fees.length).length, 0);
  const level = {ba: 'ป.ตรี', ma: 'ป.โท', phd: 'ป.เอก', grad: 'บัณฑิตศึกษา', other: ''};
  const groups = d.offerings.map(g => `<details class="offering-group"><summary>${esc(g.faculty || 'ไม่ระบุคณะ')} <span class="hint">${num(g.offerings.length)}</span></summary>
    <ul class="offering-list">${g.offerings.map(o => `<li><p class="offering-name">${esc(o.name)}${level[o.level] ? ` <span class="hint">${esc(level[o.level])}</span>` : ''}</p>
      ${o.fees.length ? `<ul class="fee-list">${o.fees.slice(0, 6).map(feeLine).join('')}</ul>${o.fees.length > 6 ? `<p class="hint">อีก ${num(o.fees.length - 6)} รายการในประกาศ</p>` : ''}` : ''}
      <p class="links">${link(o.src, 'ประกาศของมหาวิทยาลัย')}</p></li>`).join('')}</ul></details>`).join('');
  return `<section class="panel-section"><div class="section-heading">${heading('fee', 'ค่าธรรมเนียมตามประกาศ')}<span class="hint">${num(total)} หลักสูตรในประกาศ · ${num(withFees)} มีค่าธรรมเนียม</span></div>${groups}</section>`;
}

/** Quality observations of the university (08_QUALITY), verbatim with their dates; never a rank. */
function qualitySection(quality) {
  if (!quality?.length) return '';
  const row = q => `<li><strong>${esc(q.framework)}</strong>${q.programme || q.faculty ? ` · ${esc(q.programme || q.faculty)}` : ''}<br><span class="hint">${esc([q.status, q.from && q.until ? `${q.from}–${q.until}` : q.until || q.from, q.authority].filter(Boolean).join(' · '))}</span> ${link(q.src, 'ที่มา')}</li>`;
  const shown = quality.slice(0, 5), rest = quality.slice(5);
  return `<section class="panel-section"><div class="section-heading">${heading('quality', 'การรับรองคุณภาพ')}<span class="hint">${num(quality.length)} รายการ</span></div>
    <ul class="quality-list">${shown.map(row).join('')}</ul>${rest.length ? `<details><summary>อีก ${num(rest.length)} รายการ</summary><ul class="quality-list">${rest.map(row).join('')}</ul></details>` : ''}</section>`;
}

/** The university's fee coverage (26_FEE_COVERAGE): how many fee lines the research team holds, with its sources. */
function feeCoverage(fees) {
  if (!fees?.observations) return '';
  return `<p class="fact-line">${pic('fee', 'fact-icon')}ค่าธรรมเนียมที่ทีมวิจัยเก็บ ${nw(`<strong class="data-number">${num(fees.observations)}</strong> รายการ`)}${fees.sources ? ` จาก ${nw(`${num(fees.sources)} แหล่ง`)}` : ''} ${fees.urls?.[0] ? link(fees.urls[0], 'แหล่งหลัก') : ''}</p>`;
}

export function renderSite(d, ctx = {}) {
  if (!d) return '';
  const s = d.site, u = d.uni, index = ctx.index;
  const area = s.district ? index?.byId.get(s.district) : null;
  const place = [districtName(area, s.province), provinceName(s.province)].filter(Boolean).join(' · ');
  const placeChip = s.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(s.province)}">${pic('area')}${esc(place)}</button>` : '';
  const extentChip = Number.isFinite(s.extentM2) && s.extentM2 > 0
    ? `<span class="fact-chip" title="ขนาดกรอบพื้นที่โดยประมาณจาก OpenStreetMap ไม่ใช่โฉนดหรือแนวเขตตามกฎหมาย">${pic('area')}${nw(`กรอบราว ${(s.extentM2 / 1600).toLocaleString('th-TH', {maximumFractionDigits: 0})} ไร่`)}</span>` : '';
  // The area a university publishes: a single figure is a chip; a longer note stays verbatim under the sources.
  const officialShort = /^[\d,.]+ ไร่$/.test(s.officialArea || '');
  const officialChip = officialShort ? `<span class="fact-chip" title="เนื้อที่ตามที่มหาวิทยาลัยเผยแพร่">${pic('school')}${nw(`เนื้อที่ ${esc(s.officialArea)}`)}</span>` : '';
  const railChip = s.rail ? `<button type="button" class="fact-chip" data-action="select-station" data-id="${esc(s.rail.station.id)}" title="สถานีที่เปิดแล้วที่ใกล้ที่สุด · ระยะตรง">${pic('rail')}${esc(stationShort(s.rail.station))} ${nw(esc(meters(s.rail.m)))}</button>` : '';
  const nextChip = s.rail2 && (!s.rail || s.rail2.m < s.rail.m)
    ? `<span class="fact-chip" title="สถานีที่กำลังสร้างที่ใกล้ที่สุด · ระยะตรง">${pic('construction')}${esc(stationShort(s.rail2.station))} ${nw(esc(meters(s.rail2.m)))} · กำลังสร้าง</span>` : '';
  const retail = s.retail.map(v => `<a class="fact-chip" href="${esc(retailLink(v))}" target="_blank" rel="noopener" title="ศูนย์การค้าที่เชื่อมกับพื้นที่นี้ · CityMETER Shopping Center">${pic('building')}${esc(v.name)}</a>`).join('');
  const b = d.building;
  const buildingChip = b?.count ? `<span class="fact-chip" title="อาคารบนแผนที่ที่มีอาคารของคณะในพื้นที่นี้">${pic('building')}${nw(`อาคารของคณะ ${num(b.count)} หลัง`)}</span>` : '';
  const coords = hasPoint(s) ? `${s.latitude.toFixed(6)}, ${s.longitude.toFixed(6)}` : '';
  const uniName = uniLine(s);
  const siblings = d.siblings.length ? `<section class="panel-section"><div class="section-heading">${heading('school', `วิทยาเขตอื่นของ${u.name.replace(/^มหาวิทยาลัย/, 'มหาวิทยาลัย')}`)}<span class="hint">${num(d.siblings.length)} แห่ง</span></div>${siteList(d.siblings.slice(0, 8), {showProvince: true})}</section>` : '';
  const near = d.near.length ? `<section class="panel-section"><div class="section-heading">${heading('compare', 'มหาวิทยาลัยรอบ ๆ')}<span class="hint" title="ระยะตรงจากจุดของพื้นที่นี้">${pic('distance', 'hint-pic')}≤ 3 กม.</span></div>${siteList(d.near.map(x => x.site), {distance: new Map(d.near.map(x => [x.site.id, x.d]))})}</section>` : '';
  const official = Boolean(s.officialUrl || d.faculties?.length || d.offerings?.length);
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(s.series)}</span><div>
        <p class="eyebrow eyebrow-cue">${esc(typeName(s.type))}</p>
        <h2>${esc(s.name)}</h2>
        ${uniName ? `<p class="branch-name"><button type="button" class="link-button" data-action="select-uni" data-id="${esc(u.id)}">${esc(uniName)}</button></p>` : `<p class="branch-name"><button type="button" class="link-button" data-action="select-uni" data-id="${esc(u.id)}">ดูทั้งมหาวิทยาลัย</button></p>`}
        ${logoMark(u.logo, u.name)}</div></div>
      ${unitTile(s)}
      <div class="fact-chips">${placeChip}${extentChip}${officialChip}${railChip}${nextChip}${buildingChip}${retail}${coords ? '' : '<span class="fact-chip is-quiet">ไม่มีจุดบนแผนที่</span>'}</div>
      ${actionBar({kind: 'site', site: s, area: {place: districtName(area, s.province), province: provinceName(s.province)}, point: hasPoint(s) ? {lat: s.latitude, lon: s.longitude, role: 'point'} : null})}
      <details class="source-details"><summary>ที่มาและพิกัด</summary>
        <dl class="facts">
          <dt>จุด</dt><dd>${coords ? `<span class="data-number">${esc(coords)}</span><br><span class="hint">${esc(COORD_TH[s.coord] || '')}</span>` : 'ไม่มีจุด'}</dd>
          ${s.address ? `<dt>ที่อยู่</dt><dd>${esc(s.address)}</dd>` : ''}
          ${s.officialArea && !officialShort ? `<dt>เนื้อที่ที่เผยแพร่</dt><dd>${esc(s.officialArea)}</dd>` : ''}
          ${s.extent >= 0 ? '<dt>กรอบพื้นที่</dt><dd>OpenStreetMap (ODbL) · กรอบโดยประมาณ</dd>' : ''}
          ${s.unit ? `<dt>หน่วยรายงาน</dt><dd>${esc(s.unit.name)}<br><span class="hint">${esc((LINKS[s.link] || LINKS.name).title)}</span></dd>` : ''}
          ${s.roster.length ? `<dt>ทะเบียน 2566</dt><dd>${s.roster.map(r => `<span class="roster-line">${esc([r.name, r.campus].filter(Boolean).join(' · '))}</span>`).join('<br>')}</dd>` : ''}
          ${u.logo ? `<dt>โลโก้</dt><dd>${link(u.logo.page, 'หน้าที่มาของโลโก้')}<br><span class="hint">ใช้เพื่อระบุมหาวิทยาลัย</span></dd>` : ''}
          <dt>ตรวจ</dt><dd>${esc(thaiDate(s.checked))}</dd>
          <dt>รหัส</dt><dd><span class="hint data-number">${esc(s.id)}</span></dd>
        </dl>
        <p class="links">${link(s.officialUrl, 'หน้าทางการ')}</p>
      </details>
    </section>
    ${facultySection(d)}
    ${offeringSection(d)}
    ${qualitySection(d.quality)}
    ${hasPoint(s) ? `<section class="panel-section terrain-section"><div class="section-heading">${heading('elevation', 'ภูมิประเทศ')}</div>
      <div class="fact-chips terrain-chips" data-terrain-for="${esc(s.id)}"><span class="hint">กำลังอ่านภูมิประเทศ</span></div></section>` : ''}
    ${near}${siblings}
    ${provenance(ctx, place ? `${s.name} · ${place}` : s.name, {students: Boolean(s.unit || d.faculties?.length), roster: s.roster.length > 0, osm: s.extent >= 0, official, rail: Boolean(s.rail || s.rail2), terrain: hasPoint(s)})}`;
}

/* ---------- University ---------- */

export function renderUniversity(p, ctx = {}) {
  if (!p) return '';
  const u = p.uni, s = p.summary, unit = ctx.unit;
  const provinces = p.provinces.map(c => `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(c)}">${pic('province')}${esc(provinceName(c))}</button>`).join('');
  const units = p.units.length ? `<section class="panel-section"><div class="section-heading">${heading('aff', 'หน่วยรายงาน')}<span class="hint">${num(p.units.length)} หน่วย</span></div>${unitList(p.units.slice(0, 20))}
    ${p.units.length > 20 ? `<p class="hint">อีก ${num(p.units.length - 20)} หน่วย</p>` : ''}</section>` : '';
  const sites = p.sites.length ? `<section class="panel-section"><div class="section-heading">${heading('maps', 'วิทยาเขตบนแผนที่')}<span class="hint">${num(p.sites.length)} แห่ง</span></div>${siteList(p.sites, {showProvince: true})}</section>` : '';
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(u.series)}</span><div>
        <p class="eyebrow eyebrow-cue">${esc(typeName(u.type))}</p>
        <h2>${esc(u.name)}</h2>${logoMark(u.logo, u.name)}</div></div>
      <div class="metrics compact">${metricTile(s.students, 'นักศึกษา', 'students', `รวมทุกหน่วยรายงานของมหาวิทยาลัยนี้ในแฟ้ม อว. ${ctx.meta?.period?.label || ''}`)}${metricTile(s.count, 'หน่วยรายงาน', 'aff')}${metricTile(p.sites.length, 'วิทยาเขตบนแผนที่', 'maps')}</div>
      ${provinces ? `<div class="fact-chips">${provinces}</div>` : ''}
      ${feeCoverage(p.fees)}
      ${actionBar({kind: 'uni', uni: u})}
    </section>
    ${s.students ? `<section class="panel-section"><div class="section-heading">${heading('level', 'ระดับ')}<span class="hint">คน</span></div>${levelBars({ba: s.ba, ma: s.ma, phd: s.phd, other: s.other, total: s.students})}</section>` : ''}
    ${units}${sites}
    ${p.quality === null && u.qualityObs ? '<p class="hint">กำลังโหลดการรับรองคุณภาพ</p>' : qualitySection(p.quality)}
    ${provenance(ctx, `${u.name} · ทุกหน่วยรายงาน`, {students: true, roster: p.sites.some(x => x.roster.length), official: Boolean(p.fees?.observations || p.quality?.length), osm: p.sites.some(x => x.extent >= 0)})}`;
}

/* ---------- Reporting unit ---------- */

export function renderUnit(p, ctx = {}) {
  if (!p) return '';
  const u = p.unit;
  const faculties = p.faculties.filter(f => f.name);
  const shown = faculties.slice(0, 15);
  const facultyRows = shown.map(f => `<li title="${esc(f.name)} · ${num(f.students)} คน · ชาย ${num(f.male)} · หญิง ${num(f.female)}"><span class="mix-label">${esc(f.name)}</span>
    <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${u.series}" style="width:${Math.max(3, Math.round((f.students / Math.max(1, faculties[0]?.students || 1)) * 100))}%"></span></span>
    <span class="mix-value data-number">${num(f.students)}</span></li>`).join('');
  const site = u.site ? `<section class="panel-section"><div class="section-heading">${heading('maps', 'พื้นที่บนแผนที่')}</div>${siteList([u.site], {showProvince: true})}</section>` : '';
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(u.series)}</span><div>
        <p class="eyebrow eyebrow-cue">หน่วยรายงาน · ${esc(typeName(u.type))}</p>
        <h2>${esc(u.name)}</h2>
        ${u.uni.name !== u.name ? `<p class="branch-name"><button type="button" class="link-button" data-action="select-uni" data-id="${esc(u.uni.id)}">${esc(u.uni.name)}</button></p>` : `<p class="branch-name"><button type="button" class="link-button" data-action="select-uni" data-id="${esc(u.uni.id)}">ดูทั้งมหาวิทยาลัย</button></p>`}
        ${logoMark(u.uni.logo, u.uni.name)}</div></div>
      <div class="metrics compact">${metricTile(u.students, 'นักศึกษา', 'students', `ชาย ${num(u.male)} · หญิง ${num(u.female)}`)}${metricTile(faculties.length, 'คณะ', 'classroom')}${metricTile(u.programmes, 'หลักสูตร·ระดับ', 'programme', 'คู่หลักสูตรและระดับที่แฟ้มรายงาน')}</div>
      <div class="fact-chips"><button type="button" class="fact-chip" data-action="select-province" data-id="${esc(u.province)}" title="จังหวัดที่แฟ้ม อว. ระบุให้หน่วยรายงานนี้">${pic('province')}${esc(provinceName(u.province))}</button></div>
      ${actionBar({kind: 'unit', unit: u})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('level', 'ระดับ')}<span class="hint">คน</span></div>${levelBars(p.levels)}</section>
    ${faculties.length ? `<section class="panel-section"><div class="section-heading">${heading('classroom', 'คณะ')}<span class="hint">คน</span></div><ul class="mix-list faculty-bars">${facultyRows}</ul>${faculties.length > shown.length ? `<p class="hint">อีก ${num(faculties.length - shown.length)} คณะ</p>` : ''}</section>` : ''}
    ${site}
    ${provenance(ctx, `${u.name} · ${provinceName(u.province)}`, {students: true})}`;
}

/* ---------- Station (CityMETER · Transit) ---------- */

export function renderStation(p, ctx = {}) {
  if (!p) return '';
  const s = p.station;
  const building = s.status !== 'operating';
  const head = `<section class="detail-head station">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${pic('rail', 'identity-pic')}<div>
        <p class="eyebrow">สถานีรถไฟฟ้า${s.lines?.length ? ` · ${esc(s.lines.join(' · '))}` : ''}${building ? ` · ${pic('construction')}กำลังสร้าง` : ''}</p>
        <h2>สถานี${esc(s.name)}</h2>${s.nameEn ? (LANG === 'en' ? `<p class="subtle" lang="th" translate="no">สถานี${esc(s.name)}</p>` : `<p class="subtle">${esc(s.nameEn)}</p>`) : ''}</div></div>
      <div class="metrics compact">${metricTile(p.rows.length, 'วิทยาเขต', 'maps')}${metricTile(p.linked, 'มีหน่วยรายงาน', 'aff', 'วิทยาเขตที่มีหน่วยรายงานของแฟ้ม อว. ผูกไว้')}${metricTile(meters(p.radius), 'รอบสถานี', 'distance', `ระยะตรงจากจุดอ้างอิงของสถานี ${meters(p.radius)}`)}</div>
      ${actionBar({kind: 'station', station: s, point: {lat: s.lat, lon: s.lon, role: 'station'}})}
      <div class="detail-actions">${link(stationLink(s), 'ดูใน CityMETER Transit', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `รัศมี ${meters(p.radius)} จากสถานี${s.name}`;
  if (!p.rows.length) return `${head}<div class="empty-note" role="note"><strong>ไม่พบวิทยาเขตรอบสถานีนี้</strong></div>${provenance(ctx, boundary, {students: false, rail: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('maps', 'วิทยาเขต')}<span class="hint">ใกล้ก่อน</span></div>${siteList(p.rows, {distance: p.distance, index: ctx.index})}</section>
    ${provenance(ctx, boundary, {students: p.linked > 0, roster: p.rows.some(x => x.roster.length), rail: true})}`;
}

/* ---------- Building (display-time spatial join) ---------- */

/** Where a drawn building's outline and height come from (the Hotel rule of 2026-11-01, point 3). */
export const BUILDING_SOURCE_TH = Object.freeze({osm: 'OpenStreetMap', cm: 'CityMETER Building V4'});

export function renderBuilding(b, ctx = {}) {
  if (!b) return '';
  const source = BUILDING_SOURCE_TH[b.kind] || BUILDING_SOURCE_TH.osm;
  const height = b.height != null ? `<span title="ความสูงจาก ${esc(source)}">สูงราว ${num(Math.round(b.height))} ม.</span>` : '';
  const names = [...new Set(b.geoms.map(g => g.name).filter(Boolean))];
  const list = b.faculties.length
    // Names only: a faculty's students belong to its reporting unit, never to a building (DATA_METHOD.md §2).
    ? `<ul class="outlet-list faculty-list">${b.faculties.map(f => `<li><span class="faculty-row"><span class="row-text"><strong>${esc(f.name)}</strong></span>${f.info ? link(f.info, 'เว็บคณะ', 'source-link row-link') : ''}</span></li>`).join('')}</ul>`
    : '<p class="hint">ไม่มีรายชื่อคณะของอาคารนี้</p>';
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${pic('building')} ${b.site ? `<button type="button" class="link-button" data-action="select-site" data-id="${esc(b.site.id)}">${esc(b.site.name)}</button>` : 'อาคาร'}${height ? ` · ${height}` : ''}</p>
      <h2>คณะในอาคารนี้</h2>
      ${names.length ? `<p class="subtle">${esc(names.slice(0, 3).join(' · '))}</p>` : ''}
      ${actionBar({kind: 'building', site: b.site})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('classroom', 'คณะ')}<span class="hint">${num(b.faculties.length)}</span></div>${list}</section>
    ${provenance(ctx, `อาคารของคณะใน ${b.site?.name || 'พื้นที่นี้'} · ขอบอาคาร ${source}`, {osm: true, official: true})}`;
}

/** Terrain chips (js/shell/terrain.js#terrainChips) as fact chips; '' when nothing is known. */
export function terrainChipsHTML(chips) {
  return chips.map(c => `<span class="fact-chip" title="${esc(c.title)}">${pic(c.kind)}${esc(c.text)}</span>`).join('');
}

/* ---------- Active filter chips ---------- */

export function renderFilterChips(values, labels) {
  const chips = [];
  const push = (key, text) => chips.push(`<li><button type="button" class="filter-chip" data-action="clear-filter" data-id="${esc(key)}" aria-label="ล้างตัวกรอง ${esc(text)}"><span>${esc(text)}</span><i aria-hidden="true">×</i></button></li>`);
  if (values.search) push('search', `ค้นหา “${values.search}”`);
  if (values.type) push('type', labels.type[values.type] || TYPE_SHORT[values.type] || values.type);
  if (values.province) push('province', labels.province[values.province] || values.province);
  return chips.length ? `<ul class="filter-chips" aria-label="ตัวกรองที่ใช้อยู่">${chips.join('')}<li><button type="button" class="filter-chip clear-all" data-action="clear-filter" data-id="all">ล้างทั้งหมด</button></li></ul>` : '';
}

export {moreButton};
