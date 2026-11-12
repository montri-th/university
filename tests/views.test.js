/**
 * Panel views (js/panel.js) on the shipped data: one provenance line per view, no caveat on screen, a site's students
 * always named as its unit's, fees as published, the breadcrumb of production, the Google actions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {renderOverview, renderSite, renderUniversity, renderUnit, renderStation, renderBuilding, renderFilterChips, pct} from '../js/panel.js';
import {buildOverview, buildSiteDetail, buildUniversityProfile, buildUnitProfile, buildStationProfile, buildBuildingProfile, STATION_RADIUS_M} from '../js/profile-model.js';
import {summarizeInsight} from '../js/area-insight.js';
import {buildBreadcrumb, renderBreadcrumb, DATASET} from '../js/breadcrumb.js';
import {contextActions} from '../js/ask.js';
import {renderInsightChart} from '../js/charts.js';
import {unitWords, provinces, provinceByCode, siteOrder, FEE_WORDS, feeWord, cohortWords, money} from '../js/model.js';
import {GROUP_SERIES, CUES} from '../js/cues.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const nameOf = c => provinceByCode(c)?.th || c;

function views() {
  const {data, index, campus} = load();
  const ctx = {meta: data.meta, unit: unitWords('students'), index, osmDate: '2026-11-10'};
  const out = {};
  const national = buildOverview(data.units, data.sites, {types: data.types, allUnits: data.units, nameOf, stations: data.stations});
  out.overview = renderOverview({insight: summarizeInsight(data.units, {provinces: provinces(), nameOf}), overview: national, ctx});
  const bkkUnits = data.units.filter(u => u.province === 'BKK'), bkkSites = data.sites.filter(s => s.province === 'BKK');
  out.province = renderOverview({insight: summarizeInsight(data.units, {province: 'BKK', provinces: provinces(), nameOf}),
    overview: buildOverview(bkkUnits, bkkSites, {province: 'BKK', types: data.types, allUnits: data.units, nameOf, stations: data.stations}), ctx});
  const ku = data.sites.find(s => s.id === 'PILOT-KU-BANGKHEN');
  out.site = renderSite(buildSiteDetail(ku, {data, campus, siteIndex: data.sites.indexOf(ku)}), ctx);
  out.siteLoading = renderSite(buildSiteDetail(ku, {data, campus: null, siteIndex: data.sites.indexOf(ku)}), ctx);
  const plain = data.sites.find(s => !s.pilot && !s.unit && s.latitude !== null);
  out.siteNoUnit = renderSite(buildSiteDetail(plain, {data, campus, siteIndex: data.sites.indexOf(plain)}), ctx);
  out.university = renderUniversity(buildUniversityProfile(ku.uni, {campus}), ctx);
  out.unit = renderUnit(buildUnitProfile(data.units[0]), ctx);
  const station = ku.rail.station;
  out.station = renderStation(buildStationProfile(station, {sites: data.sites}), ctx);
  const geoms = (campus.bySite.get(data.sites.indexOf(ku)) || []).filter(g => g.role === 'building').slice(0, 2);
  out.building = renderBuilding(buildBuildingProfile({key: 'osm:1', kind: 'osm', height: 18, geoms, site: ku}, {campus, siteIndex: data.sites.indexOf(ku)}), ctx);
  return {out, data, ku, plain, campus};
}

test('every panel view ends with one provenance line — dataset · source · date · boundary, then the method — and carries no caveat on screen', () => {
  const {out} = views();
  const caveat = /ข้อจำกัด|ข้อควรระวัง|โปรดทราบ|อาจไม่|ไม่รับประกัน|ประมาณการ|โดยประมาณการ|caveat/i;
  for (const [name, html] of Object.entries(out)) {
    assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: one provenance line`);
    const t = text(html.slice(html.indexOf('panel-foot provenance')));
    assert.ok(/ชุดข้อมูล\s*CityMETER University/.test(t), `${name}: dataset`);
    assert.ok(/แหล่ง\s*จาก \S/.test(t), `${name}: source`);
    assert.ok(/ตรวจ \d{1,2} \S+ 25\d\d/.test(t), `${name}: date`);
    assert.ok(/ขอบเขต \S/.test(t), `${name}: boundary`);
    assert.ok(/วิธีนับ/.test(t), `${name}: method`);
    assert.ok(!caveat.test(text(html)), `${name}: no caveat on screen — ${(text(html).match(new RegExp(`.{0,40}(${caveat.source}).{0,40}`)) || [''])[0]}`);
    assert.ok(!/ตั้งอยู่ใน|ส่วนแบ่งตลาด|รายได้|ความหนาแน่น|อัตราการเข้าเรียน|ความต้องการ/.test(text(html)), `${name}: no claim the data cannot carry`);
    assert.ok(!/ 0 คน/.test(text(html)), `${name}: nothing missing reads 0 คน`);
  }
});

test('first screen: the Aha with numerator and denominator, the open-admission comparison as two bars with both bases, the zero provinces', () => {
  const {out} = views();
  const t = text(out.overview);
  assert.match(t, /55% ของนักศึกษาทั้งประเทศ อยู่ใน 3 จังหวัดนี้/);
  assert.match(t, /กรุงเทพมหานคร · ปทุมธานี · เชียงใหม่/);
  assert.match(t, /988,359 จาก 1,786,753 คน/);
  assert.match(out.overview, /title="[\d,]+ จาก [\d,]+ คน ในจังหวัดเหล่านี้ ไม่นับมหาวิทยาลัยรัฐไม่จำกัดรับ"/);
  assert.match(t, /ไม่มีหน่วยรายงาน 9 จังหวัด/);
  assert.match(t, /จังหวัดที่มีนักศึกษามากที่สุด/);
});

test('a province: the universities with the most of the measure, its national rank and share, its campuses on the map', () => {
  const {out} = views();
  const t = text(out.province);
  assert.match(t, /ของนักศึกษาในกรุงเทพมหานคร อยู่กับ 3 มหาวิทยาลัยนี้/);
  assert.match(t, /อันดับ 1 จาก 68 จังหวัดที่มีหน่วยรายงาน/);
  assert.match(out.province, /title="750,679 จาก 1,786,753 คน"/, 'the share tile carries both bases');
  assert.match(t, /วิทยาเขตบนแผนที่/);
});

test('a campus: the students are its unit’s, named; faculties with their unit figures; fees as published; nothing on a campus without a unit is 0', () => {
  const {out, ku, plain} = views();
  const t = text(out.site);
  assert.match(t, new RegExp(`${ku.unit.students.toLocaleString('en-US')} คน นักศึกษาตามหน่วยรายงานของวิทยาเขตนี้`));
  assert.match(t, /คณะในพื้นที่นี้ 22 คณะ/);
  assert.match(t, /ค่าธรรมเนียมตามประกาศ \d+ หลักสูตรในประกาศ/);
  assert.match(out.site, /class="fee-value data-number">฿[\d,]+/);
  assert.ok(!/lump_sum|per_semester|not_specified|AY25\d\d/.test(t), 'fee codes read in words');
  assert.match(t, /มหาวิทยาลัยเกษตรศาสตร์ \(สุขุมวิท\) 780 ม\./, 'the nearest operating station, straight line');
  assert.match(t, /กรอบราว [\d,]+ ไร่/);
  assert.match(text(out.siteLoading), /กำลังโหลดรายชื่อคณะ/, 'before the campus file: said, never empty');
  const p = text(out.siteNoUnit);
  assert.ok(!/นักศึกษาตาม/.test(p), `${plain.id}: no unit, no student figure`);
  assert.ok(!/ 0 คน/.test(p));
});

test('university, unit, station and building panels', () => {
  const {out, data} = views();
  assert.match(text(out.university), /หน่วยรายงาน/);
  assert.match(text(out.university), /วิทยาเขตบนแผนที่/);
  const u = data.units[0];
  assert.match(text(out.unit), new RegExp(`${u.students.toLocaleString('en-US')} นักศึกษา`));
  assert.match(text(out.unit), /ระดับ/);
  assert.match(text(out.station), /วิทยาเขต ใกล้ก่อน/);
  assert.equal(STATION_RADIUS_M, 1000);
  assert.match(text(out.station), /รัศมี 1 กม\. จากสถานี/);
  assert.match(text(out.building), /คณะในอาคารนี้/);
  assert.match(text(out.building), /สูงราว 18 ม\./);
  assert.ok(!/[\d,]+ คน/.test(text(out.building)), 'a building carries no student figure: students belong to the reporting unit');
  assert.match(text(out.site), /[\d,]+ คนตามหน่วยรายงาน · มีอาคารบนแผนที่/, 'a faculty’s figure is named as the reporting unit’s');
});

test('breadcrumb follows production: ประเทศไทย › จังหวัด › the campus (no production link on the campus)', () => {
  const {ku} = views();
  assert.equal(DATASET, '', 'no production ?d= until the registry names one');
  const crumbs = buildBreadcrumb({province: ku.province, site: {id: ku.id, name: ku.name, province: ku.province}});
  assert.deepEqual(crumbs.map(c => c.level), ['country', 'province', 'site']);
  assert.equal(crumbs[1].href, 'https://landometer.com/v3/citymeter/BKK');
  assert.equal(crumbs[2].href, undefined);
  assert.match(renderBreadcrumb(crumbs), /aria-current="location">มหาวิทยาลัยเกษตรศาสตร์ บางเขน</);
});

test('institution types bind to LDS series by stable id with the series shape cue; no star (it would read as a rating)', () => {
  const {data} = views();
  assert.equal(data.types.length, 8);
  for (const t of data.types) {
    assert.equal(t.series, GROUP_SERIES[t.id], t.id);
    assert.notEqual(CUES[t.series - 1], 'star', t.id);
  }
  assert.equal(new Set(data.types.map(t => t.series)).size, 8, 'one series per type');
});

test('lists: sites by their unit’s students, then faculties, then name — deterministic', () => {
  const {data} = views();
  const list = [...data.sites].sort(siteOrder);
  for (let i = 1; i < list.length; i++) assert.ok((list[i - 1].unit?.students || 0) >= (list[i].unit?.students || 0));
});

test('Google actions: public names and points only, https, the question of the view; Street View only with a point', () => {
  const {ku} = views();
  const site = contextActions({kind: 'site', site: ku, area: {place: 'เขตจตุจักร', province: 'กรุงเทพมหานคร'}, point: {lat: ku.latitude, lon: ku.longitude}}, 'th');
  assert.deepEqual(site.map(a => a.id), ['ai', 'maps', 'streetview']);
  for (const a of site) assert.match(a.href, /^https:\/\/www\.google\.com\//);
  assert.ok(!/udm=/.test(site[0].href), 'never straight into AI Mode');
  assert.ok(!/ชื่อพื้นที่จาก OSM/.test(decodeURIComponent(site[0].href)), 'the research team’s note is not asked');
  const uni = contextActions({kind: 'uni', uni: ku.uni}, 'th');
  assert.deepEqual(uni.map(a => a.id), ['ai'], 'no point, no Street View');
  const en = contextActions({kind: 'overview'}, 'en');
  assert.match(decodeURIComponent(en[0].href), /university students in Thailand/);
});

test('filter chips escape user text, name the filters and offer one clear-all', () => {
  const html = renderFilterChips({search: '<b>x</b>', type: 'rajabhat', province: 'CMI'}, {type: {rajabhat: 'มหาวิทยาลัยราชภัฏ'}, province: {CMI: 'เชียงใหม่'}});
  assert.ok(!html.includes('<b>x</b>'));
  assert.match(html, /มหาวิทยาลัยราชภัฏ/);
  assert.match(html, /เชียงใหม่/);
  assert.equal((html.match(/data-id="all"/g) || []).length, 1);
});

test('shares print whole percentages; a non-zero part never prints as 0%', () => {
  assert.equal(pct(1, 1000), '<1%');
  assert.equal(pct(0, 10), '0%');
  assert.equal(pct(5, 0), '—');
  assert.equal(pct(988359, 1786753), '55%');
});

test('charts: provinces in the map colour, types with their cue, universities ranked — a click emits its selection', () => {
  const {data} = views();
  const el = {innerHTML: '', querySelectorAll: () => []};
  const doc = globalThis.document;
  globalThis.document = {getElementById: () => el};
  try {
    for (const view of ['provinces', 'types', 'unis']) {
      renderInsightChart({elementId: 'chart', view, units: data.units, allUnits: data.units, types: data.types, unit: unitWords('students')});
      assert.match(el.innerHTML, /class="chart-bars"/, view);
    }
    renderInsightChart({elementId: 'chart', view: 'provinces', units: data.units, allUnits: data.units, types: data.types, unit: unitWords('students')});
    assert.match(el.innerHTML, /สีเดียวกับแผนที่/);
  } finally { globalThis.document = doc; }
});

test('fee lines: every code of the shipped data reads in words, each amount in its own currency, never converted', () => {
  const {campus} = load();
  const missing = new Set();
  let lines = 0;
  for (const list of campus.offerings.values()) for (const o of list) for (const f of o.fees) {
    lines++;
    for (const field of ['type', 'component', 'period', 'category']) if (f[field] && !(f[field] in FEE_WORDS[field])) missing.add(`${field}:${f[field]}`);
    const c = cohortWords(f.cohort);
    if (f.cohort && c === f.cohort) missing.add(`cohort:${f.cohort}`);
    assert.match(money(f.amount, f.currency), f.currency === 'THB' ? /^฿[\d,.]+$/ : new RegExp(`^${f.currency} [\\d,.]+$`));
  }
  assert.ok(lines > 0);
  assert.deepEqual([...missing], [], 'a new code needs a word in js/model.js#FEE_WORDS or cohortWords');
  assert.equal(feeWord('category', 'not_specified'), '', 'an unspecified category says nothing');
  assert.equal(cohortWords('AY2567_onward'), 'รับเข้าตั้งแต่ปีการศึกษา 2567');
  assert.equal(money(15300, 'CNY'), 'CNY 15,300');
});
