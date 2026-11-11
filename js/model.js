/**
 * Dataset vocabulary, decoding, shared filter and summary helpers of CityMETER · University.
 *
 * data/universities.json is built by scripts/build-data.py from the research master “CityMETER University & Faculty
 * Thailand — Research Master 2026-10-31” (registry research.TH.university). Two grains that are never added to each
 * other (DATA_METHOD.md §2):
 *   unit — a reporting institution of the MHESI student file, academic year 2568 semester 2 (20_INSTITUTION_CONTEXTS):
 *          the students the source reports for it, the province the source names for it, its institution type. A
 *          unit is a reporting path, not a place: its students are never put on a site, a polygon or a district.
 *   site — a campus site the research team reviewed (29_DEMO_SITES): a published or reviewed reference point, an
 *          approximate extent (OpenStreetMap, never a legal boundary), its faculties. A site may name the unit linked
 *          to it (`site.unit`, `site.link`: pilot · name · name-ws · qualified) and shows that unit's figure as the
 *          unit's, never as people on the site.
 * Roster points are 2566 MHESI roster records with a candidate coordinate that no site represents: quiet context,
 * never counted.
 *
 * Two measures (a contract, see DATA_METHOD.md §2):
 *   students (default) — Σ students the source reports per unit (“คน”, LI `li.supply`), by the unit's province.
 *   units              — reporting units (“หน่วย”, LDS `count`), by the unit's province.
 * Nothing here merges, moves or mutates a record.
 */
import {seriesOf} from './cues.js';

export const METRICS = Object.freeze({
  students: Object.freeze({id: 'students', one: 'คน', label: 'นักศึกษา', subject: 'นักศึกษา', per: 'คน'}),
  units: Object.freeze({id: 'units', one: 'หน่วย', label: 'หน่วยรายงาน', subject: 'หน่วยรายงาน', per: 'หน่วย'}),
});
export const metricOf = id => METRICS[id] || METRICS.students;
/** Unit words for a measure. */
export const unitWords = (metric = '') => ({...metricOf(metric), mode: metricOf(metric).id});
/** The value a unit adds to a measure: its reported students, or 1 unit. */
export const unitValue = (u, metric = 'students') => (metric === 'units' ? 1 : (Number.isFinite(u?.students) && u.students > 0 ? u.students : 0));
/** The value of an aggregate ({count, students}) under a measure. */
export const valueOf = (a, metric = 'students') => (metric === 'units' ? a?.count || 0 : a?.students || 0);

/** Short labels for tight places (chart columns, chips); the full Thai label stays in titles, legends and lists. */
export const TYPE_SHORT = Object.freeze({
  autonomous: 'รัฐในกำกับ', public: 'รัฐจำกัดรับ', open: 'รัฐไม่จำกัดรับ', rajabhat: 'ราชภัฏ', rmut: 'ราชมงคล',
  private: 'เอกชน', private_other: 'สถาบันเอกชน', outside: 'นอกสังกัด อว.',
});

/** Levels of the student file (LEV_NAME_TH): ป.ตรี · ป.โท · ป.เอก, and every other level the file names. */
export const LEVELS = Object.freeze([
  Object.freeze({id: 'ba', th: 'ป.ตรี', title: 'ปริญญาตรี'}),
  Object.freeze({id: 'ma', th: 'ป.โท', title: 'ปริญญาโท'}),
  Object.freeze({id: 'phd', th: 'ป.เอก', title: 'ปริญญาเอก'}),
  Object.freeze({id: 'other', th: 'อื่น ๆ', title: 'ปวช. ปวส. ประกาศนียบัตรบัณฑิต ประกาศนียบัตรบัณฑิตชั้นสูง ประกาศนียบัตร และอนุปริญญา ตามแฟ้ม อว.'}),
]);

/** Words for the codes the research master gives a fee line (33_PILOT_FEES: track, component, period, student
 *  category). The amount, its currency and its announcement are the university's; the code only says what the line is.
 *  A code without a word is shown as written, and tests/views.test.js names every code of the shipped data. */
export const FEE_WORDS = Object.freeze({
  type: Object.freeze({
    regular: 'ภาคปกติ', thai_regular: 'ภาคปกติ', special: 'ภาคพิเศษ', thai_special: 'ภาคพิเศษ',
    thai_special_project: 'โครงการพิเศษ', international: 'หลักสูตรนานาชาติ', international_regular: 'นานาชาติ ภาคปกติ',
    international_special: 'นานาชาติ ภาคพิเศษ', english_language: 'หลักสูตรภาษาอังกฤษ', english_regular: 'ภาษาอังกฤษ ภาคปกติ',
    bilingual_regular: 'สองภาษา ภาคปกติ', multiple_degree: 'หลายปริญญา', special_joint_degree: 'ปริญญาร่วม ภาคพิเศษ',
  }),
  component: Object.freeze({
    lump_sum_education_fee: 'ค่าธรรมเนียมการศึกษาเหมาจ่าย', tuition_lump_sum: 'ค่าเล่าเรียนเหมาจ่าย',
    lump_sum_tuition_fee: 'ค่าเล่าเรียนเหมาจ่าย', tuition_fee: 'ค่าเล่าเรียน', tuition_and_fees: 'ค่าเล่าเรียนและค่าธรรมเนียม',
    university_maintenance_component: 'ค่าบำรุงมหาวิทยาลัย', registration_component: 'ค่าลงทะเบียน',
    faculty_special_component: 'ค่าธรรมเนียมพิเศษของคณะ', department_maintenance_component: 'ค่าบำรุงภาควิชา',
    enrollment_confirmation_credited: 'ค่ายืนยันสิทธิ์ที่นำไปหักค่าเล่าเรียน', preparation_course: 'ค่าเรียนปรับพื้นฐาน',
    tuition_fees_net_after_confirmation: 'ค่าเล่าเรียนหลังหักค่ายืนยันสิทธิ์',
    estimated_total_programme_fees: 'ค่าใช้จ่ายตลอดหลักสูตรโดยประมาณ', student_status_maintenance_only: 'ค่ารักษาสภาพนักศึกษา',
  }),
  period: Object.freeze({
    per_semester: 'ต่อภาคการศึกษา', semester: 'ต่อภาคการศึกษา', per_regular_semester: 'ต่อภาคการศึกษาปกติ',
    per_special_semester: 'ต่อภาคการศึกษาพิเศษ', per_specialised_internship_only_semester: 'ต่อภาคที่ฝึกงานอย่างเดียว',
    per_summer: 'ต่อภาคฤดูร้อน', summer: 'ภาคฤดูร้อน', per_credit: 'ต่อหน่วยกิต', one_time: 'จ่ายครั้งเดียว',
    'June-July_preparation': 'ช่วงเตรียมความพร้อม มิ.ย.–ก.ค.', whole_programme: 'ตลอดหลักสูตร', per_academic_year: 'ต่อปีการศึกษา',
  }),
  category: Object.freeze({
    not_specified: '', thai_student: 'นักศึกษาไทย', Thai: 'นักศึกษาไทย', foreign_student: 'นักศึกษาต่างชาติ',
    thai_base_foreign_multiplier_2_except_programme_specific_rule: 'อัตรานักศึกษาไทย ต่างชาติ 2 เท่า เว้นแต่หลักสูตรกำหนดเอง',
    thai_base_foreign_multiplier_1_5_except_programme_specific_rule: 'อัตรานักศึกษาไทย ต่างชาติ 1.5 เท่า เว้นแต่หลักสูตรกำหนดเอง',
    thai_base_foreign_supplement_separate: 'อัตรานักศึกษาไทย ต่างชาติจ่ายส่วนเพิ่มแยก',
  }),
});
/** The word for a fee code, the code itself when it has none, '' for an empty code. */
export const feeWord = (field, code) => (code ? FEE_WORDS[field]?.[code] ?? code : '');
/** The intake a fee line applies to, from its cohort code: “รับเข้าตั้งแต่ปีการศึกษา 2567”. Years as the source writes
 *  them (พ.ศ. for academic years; a calendar year stays ค.ศ.). A code that matches no form is shown as written. */
export function cohortWords(code) {
  const c = String(code || '').trim();
  if (!c) return '';
  let m;
  if ((m = /^new_undergraduates_first_semester_AY(\d{4})$/.exec(c))) return `ป.ตรีเข้าใหม่ ภาคต้น ปีการศึกษา ${m[1]}`;
  if ((m = /^first_semester_AY(\d{4})_onward$/.exec(c))) return `รับเข้าตั้งแต่ภาคต้น ปีการศึกษา ${m[1]}`;
  if ((m = /^AY(\d{4})_onward$/.exec(c))) return `รับเข้าตั้งแต่ปีการศึกษา ${m[1]}`;
  if ((m = /^AY(\d{4})_admissions$/.exec(c))) return `รับเข้าปีการศึกษา ${m[1]}`;
  if ((m = /^((?:19|20)\d\d) onward$/.exec(c))) return `รับเข้าตั้งแต่ ค.ศ. ${m[1]}`;
  return c;
}
/** An amount in its own currency: baht as ฿, any other currency by its ISO code (“CNY 15,300”), never converted. */
export function money(amount, currency = 'THB') {
  const v = Number(amount).toLocaleString('th-TH', {maximumFractionDigits: 2});
  return !currency || currency === 'THB' ? `฿${v}` : `${currency} ${v}`;
}

/** How a site names its unit (29–34, 38 of the research master; DATA_METHOD.md §4). */
export const LINKS = Object.freeze({
  pilot: Object.freeze({th: 'หน่วยรายงานของวิทยาเขตนี้', title: 'ทีมวิจัยผูกหน่วยรายงานกับวิทยาเขตนี้จากชื่อวิทยาเขตและทะเบียนของมหาวิทยาลัย'}),
  name: Object.freeze({th: 'หน่วยรายงานชื่อเดียวกัน', title: 'ชื่อหน่วยรายงานในแฟ้ม อว. ตรงกับชื่อในทะเบียนสถานศึกษา อว. ปี 2566 ของพื้นที่นี้ทุกตัวอักษร'}),
  'name-ws': Object.freeze({th: 'หน่วยรายงานชื่อเดียวกัน', title: 'ชื่อหน่วยรายงานในแฟ้ม อว. ตรงกับชื่อในทะเบียนสถานศึกษา อว. ปี 2566 ของพื้นที่นี้ เมื่อไม่นับช่องว่าง'}),
  qualified: Object.freeze({th: 'หน่วยรายงานที่ระบุวิทยาเขต', title: 'ชื่อหน่วยรายงานระบุวิทยาเขต และวิทยาเขตมีที่ตั้งทางการที่ตรวจแล้ว'}),
});

/** What a site's point is (29_DEMO_SITES.coordinate_status); said in the source details only. */
export const COORD_TH = Object.freeze({
  official: 'จุดอ้างอิงที่มหาวิทยาลัยเผยแพร่',
  roster: 'จุดในทะเบียนสถานศึกษา อว. ปี 2566 ที่ทีมวิจัยตรวจกับกรอบพื้นที่ OpenStreetMap',
  extent: 'จุดในกรอบพื้นที่ OpenStreetMap',
  building: 'จุดอาคารที่มีชื่อของมหาวิทยาลัย',
  linked: 'จุดอ้างอิงที่หน้าเว็บของมหาวิทยาลัยเชื่อมไป',
});

/**
 * Symbol size on the map: one size for every site (a site carries no students of its own — the Hotel size rule reads a
 * figure of the point itself, which a campus site does not have). Radius (px) by zoom; the legend and the HTML pins
 * use the same numbers.
 */
export const PIN_SCALE = Object.freeze([[5, 3], [7, 3.6], [9, 4.4], [11, 5.4], [13, 6.6], [15, 7.6], [17, 8.6], [19, 9.4]]);
export function pinRadius(zoom) {
  const s = PIN_SCALE;
  if (!(zoom > s[0][0])) return s[0][1];
  for (let i = 1; i < s.length; i++) if (zoom <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (zoom - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  return s.at(-1)[1];
}
/** The same size as a MapLibre expression: `factor` × radius + `add` px, capped (zoom stays the top-level input). */
export function pinSizeExpression(factor = 1, add = 0, cap = 1e6) {
  return ['interpolate', ['linear'], ['zoom'], ...PIN_SCALE.flatMap(([z, k]) => [z, Math.min(cap, factor * k) + add])];
}

/** Every province of the production base info, keyed by the production route code (/v3/citymeter/{code}). */
let PROVINCE_LIST = [];
export function setProvinces(list) { PROVINCE_LIST = Object.freeze((list || []).map(p => Object.freeze({code: p.id, dopa: p.code, th: p.name, en: p.nameEn}))); }
export const provinces = () => PROVINCE_LIST;
export const provinceByCode = code => PROVINCE_LIST.find(p => p.code === String(code || '').toUpperCase()) || null;
/** Accept a production code (BKK), a DOPA code (10) or an English/Thai name; returns the production code or ''. */
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  const p = PROVINCE_LIST.find(x => x.code === v.toUpperCase() || x.dopa === v || x.en.toLowerCase() === v.toLowerCase() || x.th === v);
  return p ? p.code : '';
};

/** A usable coordinate inside Thailand's bounding box (never invented). */
export const hasPoint = r => Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude) &&
  r.latitude >= 5 && r.latitude <= 21 && r.longitude >= 97 && r.longitude <= 106;

const lower = v => String(v || '').toLocaleLowerCase('th-TH');
const COLLATOR = new Intl.Collator('th');

/**
 * Decode data/universities.json into records plus dictionaries. `index` (js/areas.js#buildAreaIndex) gives the names
 * of provinces and districts for search; every province code of the file must be a production province.
 */
export function decodeDataset(json, index = null) {
  if (!json?.units?.key || !json?.sites?.key || !Array.isArray(json?.universities)) throw new Error('Invalid university dataset');
  const meta = json.meta || {};
  const types = (meta.types || []).map((t, i) => ({id: t.id, th: t.th, en: t.en, index: i, series: seriesOf(t.id), short: TYPE_SHORT[t.id] || t.th}));
  const typeById = new Map(types.map(t => [t.id, t]));
  const codes = json.provinces || [];
  if (index) for (const c of codes) if (!index.provinceById.get(c)) throw new Error(`Unknown province ${c}`);
  const provinceName = c => index?.provinceById.get(c)?.name || '';
  const provinceEn = c => index?.provinceById.get(c)?.nameEn || '';
  const stations = (json.stations || []).map(s => ({...s}));

  const universities = json.universities.map((u, i) => {
    const t = typeById.get(u.type) || null;
    return {id: u.key, index: i, kind: 'uni', name: u.name, type: t, series: t?.series || 9, students: u.students || 0, latest: Boolean(u.latest),
      typeFrom: u.typeFrom || '', feeObs: u.feeObs || 0, qualityObs: u.qualityObs || 0, logo: u.logo || null, fees: u.fees || null,
      units: [], sites: [], rosterPoints: 0};
  });

  const U = json.units;
  const units = U.key.map((key, i) => {
    const t = types[U.type[i]];
    const uni = universities[U.uni[i]];
    const province = codes[U.province[i]];
    const u = {id: key, kind: 'unit', name: U.name[i], uni, province, type: t, series: t.series,
      students: U.students[i], male: U.male[i], female: U.female[i], ba: U.ba[i], ma: U.ma[i], phd: U.phd[i], other: U.other[i],
      programmes: U.programmes[i],
      faculties: (U.faculties[i] || []).map(([name, students, male, female, programmes, kind]) => ({name, students, male, female, programmes, kind})),
      site: null};
    u.search = lower([u.name, uni.name, provinceName(province), provinceEn(province)].join(' '));
    uni.units.push(u);
    return u;
  });

  const S = json.sites;
  const station = (i, m) => (i >= 0 && stations[i] ? {station: stations[i], m} : null);
  const sites = S.key.map((key, i) => {
    const t = S.type[i] >= 0 ? types[S.type[i]] : null;
    const uni = universities[S.uni[i]];
    const province = S.province[i] >= 0 ? codes[S.province[i]] : '';
    const district = S.district[i] || '';
    const s = {id: key, kind: 'site', name: S.name[i], uni, type: t, series: t?.series || 9, siteKind: S.kind[i],
      latitude: S.lat[i], longitude: S.lon[i], coord: S.coord[i] || '', province, district,
      unit: S.unit[i] >= 0 ? units[S.unit[i]] : null, link: S.link[i] || '',
      extent: S.extent[i], extentM2: S.extentM2[i], officialArea: S.officialArea[i] || '', officialUrl: S.officialUrl[i] || '', address: S.address[i] || '',
      faculties: S.faculties[i] || 0, offerings: S.offerings[i] || 0, feeOfferings: S.feeOfferings[i] || 0,
      rail: station(S.rail[i], S.railM[i]), rail2: station(S.rail2[i], S.rail2M[i]), retail: S.retail[i] || [], roster: S.roster[i] || [],
      pilot: Boolean(S.pilot[i]), checked: S.checked[i] || ''};
    const area = district ? index?.byId.get(district) : null;
    s.search = lower([s.name, uni.name, area?.name, area?.nameEn, provinceName(province), provinceEn(province)].join(' '));
    if (s.unit) s.unit.site = s;
    uni.sites.push(s);
    return s;
  });

  const R = json.roster || {key: []};
  const roster = R.key.map((key, i) => {
    const t = types[R.type[i]];
    const uni = R.uni[i] >= 0 ? universities[R.uni[i]] : null;
    if (uni) uni.rosterPoints++;
    return {id: key, kind: 'roster', name: R.name[i], type: t, series: t.series, campus: R.campus[i] || '', latitude: R.lat[i], longitude: R.lon[i],
      province: codes[R.province[i]], district: R.district[i] || '', uni};
  });

  // Labels (js/labels.js): a site linked to a unit ranks by that unit's students, the others after them (never a guess).
  const ranked = sites.filter(s => s.unit).map(s => s.unit.students).sort((a, b) => a - b);
  for (const s of sites) {
    let lo = 0;
    if (s.unit) { let hi = ranked.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ranked[mid] <= s.unit.students) lo = mid + 1; else hi = mid; } }
    s.importance = s.unit ? lo / Math.max(1, ranked.length) : s.faculties ? 0.05 : 0;
  }
  for (const u of universities) {
    u.units.sort((a, b) => b.students - a.students || COLLATOR.compare(a.name, b.name));
    u.sites.sort((a, b) => (b.unit?.students || 0) - (a.unit?.students || 0) || COLLATOR.compare(a.name, b.name));
  }
  return {meta, types, typeById, universities, units, sites, roster, stations, provinces: codes};
}

/** Units under the filters (type · province · search over the unit, its university and its province). */
export function filterUnits(units, f = {}) {
  const q = lower(f.search).trim();
  return units.filter(u => (!f.type || u.type.id === f.type) && (!f.province || u.province === f.province) && (!q || u.search.includes(q)));
}

/** Sites under the filters (type · province of the site's point · search over the site, its university and its place). */
export function filterSites(sites, f = {}) {
  const q = lower(f.search).trim();
  return sites.filter(s => (!f.type || s.type?.id === f.type) && (!f.province || s.province === f.province) && (!q || s.search.includes(q)));
}

/** Roster points under the type and province filters (search names a site or a unit, never a roster record). */
export function filterRoster(points, f = {}) {
  return points.filter(p => (!f.type || p.type.id === f.type) && (!f.province || p.province === f.province));
}

/** Totals of a set of units. */
export function summarize(units = []) {
  const unis = new Set(), provs = new Set();
  let students = 0, male = 0, female = 0, ba = 0, ma = 0, phd = 0, other = 0;
  for (const u of units) {
    students += u.students || 0; male += u.male || 0; female += u.female || 0;
    ba += u.ba || 0; ma += u.ma || 0; phd += u.phd || 0; other += u.other || 0;
    unis.add(u.uni.id); provs.add(u.province);
  }
  return {count: units.length, students, male, female, ba, ma, phd, other, universities: unis.size, provinces: provs.size};
}

/** Units per institution type under a measure (every type listed, zero included). */
export function typeMixOf(units, types, metric = 'students') {
  const by = new Map(types.map(t => [t.id, {...t, count: 0, students: 0, value: 0}]));
  for (const u of units) { const x = by.get(u.type.id); x.count++; x.students += u.students; x.value += unitValue(u, metric); }
  return [...by.values()];
}

/** Sites per institution type (sites carry no students: a count of sites). */
export function siteTypeMixOf(sites, types) {
  const by = new Map(types.map(t => [t.id, {...t, count: 0}]));
  for (const s of sites) if (s.type) by.get(s.type.id).count++;
  return [...by.values()];
}

/** Per-province totals of a set of units: Map(code → {code, value, count, students}). */
export function provinceTotals(units, metric = 'students') {
  const by = new Map();
  for (const u of units) {
    let p = by.get(u.province);
    if (!p) by.set(u.province, p = {code: u.province, value: 0, count: 0, students: 0});
    p.value += unitValue(u, metric); p.count++; p.students += u.students;
  }
  return by;
}

/** Universities of a set of units, aggregated (a university with units in two provinces sums the units given). */
export function universitiesOf(units, metric = 'students') {
  const by = new Map();
  for (const u of units) {
    let x = by.get(u.uni.id);
    if (!x) by.set(u.uni.id, x = {uni: u.uni, id: u.uni.id, name: u.uni.name, series: u.series, type: u.type, value: 0, count: 0, students: 0, provinces: new Set()});
    x.value += unitValue(u, metric); x.count++; x.students += u.students; x.provinces.add(u.province);
  }
  return [...by.values()].sort((a, b) => b.value - a.value || b.students - a.students || COLLATOR.compare(a.name, b.name));
}

/** Units ranked by the measure (ties by students, then name). */
export const unitOrder = (a, b) => b.students - a.students || COLLATOR.compare(a.name, b.name);
/** Sites in reading order: linked unit's students, then name. */
export const siteOrder = (a, b) => (b.unit?.students || 0) - (a.unit?.students || 0) || (b.faculties - a.faculties) || COLLATOR.compare(a.name, b.name);

/** Straight-line distance in metres. */
export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const safeURL = value => {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
};

/** Production CityMETER (the logo and “ดูใน CityMETER”): the place alone while production carries no University dataset. */
export const PRODUCTION = 'https://landometer.com/v3/citymeter';
export function productionLink({province = ''} = {}) {
  return province ? `${PRODUCTION}/${encodeURIComponent(province)}` : PRODUCTION;
}
/** Other demos of the same registry (context links). */
export const TRANSIT_SITE = 'https://montri-th.github.io/transit/';
export const stationLink = s => (s?.id ? `${TRANSIT_SITE}?station=${encodeURIComponent(s.id)}` : '');
export const SHOPPING_SITE = 'https://montri-th.github.io/shoppingcenter/';
export const retailLink = v => (v?.venue ? `${SHOPPING_SITE}?venue=${encodeURIComponent(v.venue)}` : '');
