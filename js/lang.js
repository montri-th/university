/**
 * University · page language (citymeter-shell, js/shell/i18n.js). js/app.js imports this module first, so an English
 * page is translated before anything renders. The words are in js/lang-en.js. Names come from the data's own English and
 * are never translated here (demo-platform-review §5.8): provinces and districts from the area index (OpenGISData-
 * Thailand names, DOPA-credited, data/area-index.json metadata.englishNames), stations from their nameEn, institution
 * types from meta.types[].en. The research master carries no English names for universities, reporting units, campus
 * sites or faculties: they stay Thai (keepThai), and so do the programme names, fee lines and quality texts the
 * universities publish.
 */
import {LANG, registerDictionary, registerNames, keepThai, startTranslation} from './shell/i18n.js';
import UNIVERSITY_EN from './lang-en.js';

const THAI = /[ก-ฺเ-๎]/;

if (LANG === 'en') {
  registerDictionary(UNIVERSITY_EN);
  startTranslation();
  // The English is a draft until reviewed (demo-platform-review §5.8): the help dialog says so.
  const note = () => {
    const intro = document.querySelector('.usage-dialog .help-intro');
    if (!intro || document.getElementById('draft-english-note')) return;
    const p = document.createElement('p');
    p.id = 'draft-english-note';
    p.className = 'help-intro';
    p.textContent = 'English is a draft translation from the Thai. University, campus, reporting-unit and faculty names have no English in the data and stay in Thai, and so do the programme names, fee lines and quality texts the universities publish. The product statement is in Thai.';
    intro.after(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note, {once: true}); else note();
}

/** Register the English the data carries. index = js/areas.js buildAreaIndex, data = js/model.js decodeDataset. */
export function registerDataNames({index, data}) {
  if (LANG !== 'en') return;
  const labels = {};
  for (const t of data?.types || []) {
    if (t.th && t.en) labels[t.th] = t.en;
    if (t.short && t.en && !labels[t.short]) labels[t.short] = t.en;
  }
  registerDictionary({exact: labels});
  const pairs = [];
  for (const p of index?.provinces || []) if (p.nameEn) pairs.push([p.name, p.nameEn], [`จังหวัด${p.name}`, p.nameEn]);
  const bangkok = (index?.provinces || []).find(p => p.id === 'BKK')?.nameEn;
  if (bangkok) pairs.push(['กรุงเทพฯ', bangkok], ['กรุงเทพ', bangkok]);
  for (const a of index?.areas || []) {
    if (!a.nameEn) continue;
    pairs.push([a.name, a.nameEn], [`${a.province === 'BKK' ? 'เขต' : 'อำเภอ'}${a.name}`, a.nameEn]);
  }
  // Stations: the name alone, with “สถานี”, and with their lines as js/panel.js writes them (“อโศก (สุขุมวิท)”).
  const lineEn = l => (THAI.test(l) ? UNIVERSITY_EN.exact[l] || null : l);
  const thaiStations = [];
  for (const s of data?.stations || []) {
    if (!s.nameEn) {
      const th = s.lines?.length ? `${s.name} (${s.lines.join(' · ')})` : '';
      thaiStations.push(s.name, `สถานี${s.name}`, ...(th ? [th, `สถานี${th}`] : []));
      continue;
    }
    pairs.push([s.name, s.nameEn], [`สถานี${s.name}`, `${s.nameEn} station`]);
    const lines = (s.lines || []).map(lineEn);
    if (s.lines?.length && lines.every(Boolean)) {
      const th = `${s.name} (${s.lines.join(' · ')})`, en = `(${lines.join(' · ')})`;
      pairs.push([th, `${s.nameEn} ${en}`], [`สถานี${th}`, `${s.nameEn} station ${en}`]);
    }
  }
  // Universities, units, sites and faculties have no English in the research master: they stay Thai.
  const thaiNames = [];
  for (const u of data?.universities || []) thaiNames.push(u.name);
  for (const u of data?.units || []) { thaiNames.push(u.name); for (const f of u.faculties) thaiNames.push(f.name); }
  for (const s of data?.sites || []) thaiNames.push(s.name, s.address, s.officialArea, ...s.roster.map(r => r.name), ...s.retail.map(v => v.name));
  registerNames(pairs);
  keepThai([...thaiNames, ...thaiStations].filter(v => v && THAI.test(v)));
}

/** The campus file (loaded after the first paint): faculty, programme, fee and quality texts as published stay Thai. */
export function registerCampusNames(campus) {
  if (LANG !== 'en' || !campus) return;
  const thai = [];
  for (const g of campus.geometry || []) thai.push(g.name);
  for (const list of campus.faculties?.values?.() || []) for (const f of list) thai.push(f.name, f.kind, f.coverage);
  // Fee lines are not here: their codes read in words (js/model.js#FEE_WORDS), which js/lang-en.js translates.
  for (const list of campus.offerings?.values?.() || []) for (const o of list) thai.push(o.faculty, o.name);
  for (const list of campus.quality?.values?.() || []) for (const q of list) thai.push(q.framework, q.programme, q.faculty, q.status, q.authority, q.scope);
  keepThai(thai.filter(v => v && THAI.test(v)));
}
