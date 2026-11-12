/**
 * What the search box of CityMETER · University knows by name: the entries js/shell/fuzzy.js matches and
 * js/shell/search.js lists (release 0.2.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว
 * implement กับ demo web ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”, and 13:15:
 * “รวม university ไว้ด้วยกันเลย”).
 *
 * The product statement asks in which province students gather and what campuses stand round a plot. So a name typed
 * here opens what answers it: a province (its students and reporting units), an institution type (its filter), a
 * university (its campuses and units), a campus (its page on the map), a reporting unit with a name of its own (its
 * students by level and faculty), or a rail station (the campuses round it). The order below is the order among equal
 * matches: a university comes before a station of the same name, and the station is not chosen ahead (“ธรรมศาสตร์”).
 *
 * Pure: entries from the decoded dataset; no DOM, no numbers shown (a row names what it is and where). Names of
 * universities, campuses and units have no English in the data: they are found, and shown, in Thai.
 */
import {provinces} from './model.js';
import {PROVINCE_AKA, key1} from './shell/fuzzy.js';

export const SEARCH_KINDS = Object.freeze([
  {id: 'province', level: 'province', auto: true}, {id: 'type', auto: true},
  {id: 'uni'}, {id: 'site'}, {id: 'unit'}, {id: 'station', level: 'station'},
]);
/** Words a name may begin with, or carry, that people add or leave out; an array is one word and its abbreviations. */
export const SEARCH_HEADS = Object.freeze([['มหาวิทยาลัยเทคโนโลยีราชมงคล', 'มทร.'], ['มหาวิทยาลัยราชภัฏ', 'มรภ.'], ['มหาวิทยาลัย', 'ม.', 'มหาลัย'], 'สถาบัน', 'วิทยาลัย', 'university', 'college', 'institute']);
/** What to try when nothing is found: the kinds of name this demo knows. */
export const SEARCH_HINT = 'ลองชื่อมหาวิทยาลัย วิทยาเขต ประเภทสถาบัน สถานี หรือจังหวัด';

/** Every entry: provinces and types first, then universities, campuses, reporting units and stations. */
export function* searchEntries({data}) {
  const byCode = new Map(provinces().map(p => [p.code, p]));
  const places = new Map();
  const placeOf = code => { if (!places.has(code)) { const p = byCode.get(code); places.set(code, [p?.th, p?.en]); } return places.get(code); };
  for (const p of provinces()) yield {id: p.code, kind: 'province', name: p.th, nameEn: p.en, aka: PROVINCE_AKA[p.th], codes: [p.code, p.dopa], province: p.code};
  for (const t of data.types) yield {id: t.id, kind: 'type', name: t.th, nameEn: t.en, aka: [t.short]};
  for (const u of data.universities) yield {id: u.id, kind: 'uni', name: u.name, weight: u.students || 0, uni: u};
  for (const s of data.sites) yield {id: s.id, kind: 'site', name: s.name, within: placeOf(s.province), province: s.province, weight: s.importance || 0, site: s};
  // A reporting unit that has the name of its university is that university's row; one with a name of its own is listed.
  for (const u of data.units) if (key1(u.name) !== key1(u.uni?.name || '')) yield {id: u.id, kind: 'unit', name: u.name, within: placeOf(u.province), province: u.province, weight: u.students || 0, unit: u};
  for (const s of data.stations) yield {id: s.id, kind: 'station', name: s.name, nameEn: s.nameEn, station: s};
}

/** The line under a name in the list: what it is and where. Thai; an English page translates it part by part. */
export function searchNote(entry) {
  const province = code => provinces().find(p => p.code === code)?.th || '';
  if (entry.kind === 'province') return 'จังหวัด';
  if (entry.kind === 'type') return 'ประเภทสถาบัน';
  if (entry.kind === 'uni') return ['สถาบัน', entry.uni.type?.th].filter(Boolean).join(' · ');
  if (entry.kind === 'site') return ['วิทยาเขต', province(entry.site.province)].filter(Boolean).join(' · ');
  if (entry.kind === 'unit') return ['หน่วยรายงาน', province(entry.unit.province)].filter(Boolean).join(' · ');
  // A station reads as the head of its own panel does: the word, its lines, “กำลังสร้าง” while it is being built.
  return ['สถานีรถไฟฟ้า', ...(entry.station.lines || []), entry.station.status === 'construction' ? 'กำลังสร้าง' : ''].filter(Boolean).join(' · ');
}
