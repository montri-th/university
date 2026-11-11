/**
 * The shipped data: data/universities.json and data/campus.json as scripts/build-data.py wrote them, decoded as the
 * browser does. Two grains (DATA_METHOD.md §2): reporting units carry the students by the province the source names;
 * sites carry points, extents and faculties, and a site names its unit at most once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, load, readBytes, sha256} from './helpers.js';
import {hasPoint, distanceM, provinceTotals, LINKS, COORD_TH} from '../js/model.js';

test('units: every reporting unit of the student file 2568/2, ids unique, students add up level by level and faculty by faculty', () => {
  const {data, raw} = load();
  assert.equal(data.units.length, raw.meta.counts.units);
  assert.equal(new Set(data.units.map(u => u.id)).size, data.units.length, 'unit ids unique');
  const total = data.units.reduce((s, u) => s + u.students, 0);
  assert.equal(total, raw.meta.counts.students);
  assert.equal(raw.meta.period.label, '2568/2');
  for (const u of data.units) {
    assert.ok(u.students > 0, `${u.id}: reported students`);
    assert.equal(u.ba + u.ma + u.phd + u.other, u.students, `${u.id}: levels add up`);
    assert.equal(u.faculties.reduce((s, f) => s + f.students, 0), u.students, `${u.id}: faculties add up`);
    assert.equal(u.male + u.female, u.students, `${u.id}: male + female`);
    assert.ok(u.type && u.series >= 1 && u.series <= 10 && u.series !== 6, `${u.id}: a type bound to a series (no star)`);
  }
  // A university sums its units; the units of the latest period carry the 01_UNIVERSITIES totals.
  for (const uni of data.universities.filter(x => x.units.length)) assert.equal(uni.units.reduce((s, u) => s + u.students, 0), uni.students, uni.name);
});

test('provinces: every unit names a production province; the totals add up to the whole; provinces with no unit are measured zero', () => {
  const {data, index, raw} = load();
  for (const u of data.units) assert.ok(index.provinceById.get(u.province), `${u.id}: ${u.province}`);
  const by = provinceTotals(data.units);
  assert.equal([...by.values()].reduce((s, p) => s + p.value, 0), raw.meta.counts.students);
  assert.equal(by.size, raw.meta.counts.provincesWithUnits);
  const zero = index.provinces.map(p => p.id).filter(c => !by.has(c)).sort();
  assert.deepEqual(zero, [...raw.meta.counts.provincesWithoutUnits].sort());
  assert.equal(by.size + zero.length, 77);
});

test('sites: unique keys, points inside Thailand in a production district of their province, a known point role', () => {
  const {data, index} = load();
  assert.equal(new Set(data.sites.map(s => s.id)).size, data.sites.length);
  for (const s of data.sites) {
    assert.ok(s.uni, `${s.id}: a university`);
    if (!hasPoint(s)) { assert.equal(s.latitude, null, `${s.id}: no point is null, never 0`); continue; }
    assert.ok(COORD_TH[s.coord], `${s.id}: point role ${s.coord}`);
    const area = index.byId.get(s.district);
    assert.ok(area, `${s.id}: district ${s.district}`);
    assert.equal(area.province, s.province, `${s.id}: the district lies in the site's province`);
  }
});

test('a site names its unit at most once and a unit has at most one site; every link says how it was made', () => {
  const {data} = load();
  const linked = data.sites.filter(s => s.unit);
  assert.equal(new Set(linked.map(s => s.unit.id)).size, linked.length, 'no unit is linked to two sites');
  for (const s of linked) {
    assert.ok(LINKS[s.link], `${s.id}: link kind ${s.link}`);
    assert.equal(s.unit.site, s, `${s.id}: the unit points back`);
  }
  for (const s of data.sites.filter(x => !x.unit)) assert.equal(s.link, '', `${s.id}: no unit, no link`);
});

test('roster points: 2566 records no site represents, inside their own record’s province, never counted', () => {
  const {data, raw, index} = load();
  assert.equal(data.roster.length, raw.meta.counts.rosterPoints);
  for (const p of data.roster) {
    assert.ok(hasPoint(p), p.id);
    assert.ok(index.provinceById.get(p.province), p.id);
    if (p.district) assert.equal(index.byId.get(p.district)?.province, p.province, `${p.id}: point in its province`);
    assert.ok(!('students' in p), 'a roster point carries no students');
  }
});

test('context from CityMETER Transit: straight-line distances agree with the published points; only operating stations are “nearest”', () => {
  const {data} = load();
  let n = 0;
  for (const s of data.sites.filter(x => x.rail)) {
    n++;
    assert.equal(s.rail.station.status, 'operating');
    const d = distanceM(s.latitude, s.longitude, s.rail.station.lat, s.rail.station.lon);
    assert.ok(Math.abs(d - s.rail.m) <= 2, `${s.id}: ${s.rail.m} vs ${d}`);
    assert.ok(s.rail.m <= 2000);
  }
  for (const s of data.sites.filter(x => x.rail2)) assert.equal(s.rail2.station.status, 'construction');
  assert.ok(n >= 20, `${n} sites near rail`);
});

test('campus file: extents are the sites’ own, faculty geometry stays on its site, every fee line has an amount and its source', () => {
  const {data, campus} = load();
  for (const [i, s] of data.sites.entries()) {
    if (s.extent < 0) continue;
    const g = campus.geometry[s.extent];
    assert.equal(g.role, 'extent', s.id);
    assert.equal(g.site, i, `${s.id}: its own extent`);
  }
  for (const [site, list] of campus.faculties) {
    assert.ok(data.sites[site], `faculties of site ${site}`);
    for (const f of list) for (const gi of f.geoms) assert.equal(campus.geometry[gi].site, site, `${f.name}: geometry of its own site`);
    assert.equal(data.sites[site].faculties, list.length);
  }
  let fees = 0;
  for (const [site, list] of campus.offerings) {
    assert.ok(data.sites[site].pilot, 'programmes and fees only for the pilot campuses');
    for (const o of list) for (const f of o.fees) {
      fees++;
      assert.ok(Number.isFinite(f.amount) && f.amount >= 0, `${o.id}: amount`);
      assert.ok(f.currency, `${o.id}: currency`);
      assert.ok(f.src === '' || /^https?:\/\//.test(f.src), `${o.id}: public source`);
    }
  }
  assert.ok(fees > 0);
  for (const g of campus.geometry) assert.equal(g.role === 'extent' || g.role === 'building' || g.role === 'shared' || g.role === 'area' || g.role === 'point', true, g.id);
});

test('logos: every file the data names is shipped, named by its SHA-256 and equal to it', () => {
  const {data} = load();
  const logos = data.universities.filter(u => u.logo);
  assert.ok(logos.length >= 10);
  for (const u of logos) {
    const path = join(ROOT, u.logo.file);
    assert.ok(existsSync(path), u.logo.file);
    assert.equal(sha256(readBytes(u.logo.file)), u.logo.sha256, u.logo.file);
    assert.ok(u.logo.file.includes(u.logo.sha256.slice(0, 16)), 'content-addressed file name');
    assert.ok(['light', 'dark', 'light_or_dark'].includes(u.logo.surface));
  }
});

test('publication hygiene: no official roster codes, no private links, no e-mail; links are http(s)', () => {
  const {raw, campusRaw} = load();
  const text = JSON.stringify(raw) + JSON.stringify(campusRaw);
  assert.ok(!/(docs|drive)\.google\.com/.test(text), 'no Google document link');
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text.replace(/https?:\/\/[^"\s]+/g, '')), 'no e-mail address');
  for (const roster of raw.sites.roster) for (const r of roster) assert.deepEqual(Object.keys(r).sort(), ['campus', 'name'], 'the roster’s UNIV_ID is not copied');
  assert.ok(raw.meta.excludedFields.some(f => /UNIV_ID/.test(f)));
  const records = JSON.stringify({...raw, meta: null}) + JSON.stringify({...campusRaw, meta: null}); // meta names its sources in words
  const urls = [...records.matchAll(/"(?:src|officialUrl|url|page|evidence|info|source)":"([^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.every(u => /^https?:\/\//.test(u)), 'source links are http(s)');
  assert.ok(raw.meta.exportSha256 && /^[0-9a-f]{64}$/.test(raw.meta.exportSha256));
  for (const [t, m] of Object.entries(raw.meta.tabs)) assert.match(m.sha256, /^[0-9a-f]{64}$/, t);
});
