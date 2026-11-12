/**
 * The search box of CityMETER · University (0.2.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว
 * implement กับ demo web ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”; 13:15: “รวม
 * university ไว้ด้วยกันเลย”): the names js/find.js gives js/shell/fuzzy.js, read from the shipped data, and what a name
 * typed opens.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {load, ROOT} from './helpers.js';
import {createIndex, key1, STEP} from '../js/shell/fuzzy.js';
import {SEARCH_KINDS, SEARCH_HEADS, SEARCH_HINT, searchEntries, searchNote} from '../js/find.js';
import {filterUnits, filterSites} from '../js/model.js';
import {translate, translateIn, registerDictionary} from '../js/shell/i18n.js';
import UNIVERSITY_EN from '../js/lang-en.js';

let built = null;
function index() {
  if (!built) {
    const loaded = load();
    const idx = createIndex({kinds: SEARCH_KINDS, heads: SEARCH_HEADS});
    idx.addAll(searchEntries(loaded));
    built = {idx, ...loaded};
  }
  return built;
}
const top = (result, n = 5) => result.items.slice(0, n).map(i => `${i.entry.kind}:${i.entry.id}`);

test('every province, type, university, campus and station of the data can be found by name', () => {
  const {idx, data} = index();
  const entries = [...searchEntries(index())];
  assert.equal(idx.size, entries.length);
  assert.deepEqual([...new Set(entries.map(e => e.kind))].sort(), SEARCH_KINDS.map(k => k.id).sort(), 'every kind the list names has entries');
  assert.equal(entries.filter(e => e.kind === 'uni').length, data.universities.length);
  assert.equal(entries.filter(e => e.kind === 'site').length, data.sites.length);
  // A reporting unit is listed when its name is its own; one that has its university's name is that university's row.
  const units = entries.filter(e => e.kind === 'unit');
  assert.ok(units.length > 0 && units.length < data.units.length && units.every(e => key1(e.name) !== key1(e.unit.uni?.name || '')));
  for (const e of entries.filter(e => ['uni', 'site', 'unit'].includes(e.kind))) {
    assert.ok(idx.search(e.name, {province: e.province}).items.slice(0, 12).some(i => i.entry.kind === e.kind && i.entry.id === e.id), `${e.kind} ${e.name}`);
  }
});

test('a name typed opens what answers it: a province chosen ahead, a university before a station of its name', () => {
  const {idx} = index();
  let r = idx.search('เชียงใหม่');
  assert.deepEqual([top(r, 1)[0], r.preselect?.id, r.items[1].entry.name], ['province:CMI', 'CMI', 'มหาวิทยาลัยเชียงใหม่'], 'the province is chosen ahead; the universities that go by its name are the next rows');
  r = idx.search('จ.ภูเก็ต');
  assert.deepEqual([top(r, 1)[0], r.preselect?.kind, r.total], ['province:PKT', 'province', 1]);
  r = idx.search('โคราช');
  assert.deepEqual([top(r, 1)[0], r.items[0].matched], ['province:NMA', 'โคราช']);
  r = idx.search('ธรรมศาสตร์');
  assert.deepEqual([r.items[0].entry.kind, r.items[0].entry.name, r.items[0].step, r.preselect], ['uni', 'มหาวิทยาลัยธรรมศาสตร์', STEP.name, null]);
  r = idx.search('มหาลัยรามคำแหง');
  assert.deepEqual(r.items.slice(0, 2).map(i => [i.entry.kind, i.entry.name]), [['uni', 'มหาวิทยาลัยรามคำแหง'], ['site', 'มหาวิทยาลัยรามคำแหง']], 'a word and the ways it is said are one word');
  assert.ok(r.items.some(i => i.entry.kind === 'station' && i.entry.name === 'รามคำแหง') && r.preselect === null, 'the station of that name is in the list and is not chosen ahead');
  assert.equal(idx.search('ม.เกษตร').items[0].entry.name, 'มหาวิทยาลัยเกษตรศาสตร์');
  assert.equal(idx.search('มทร.ธัญบุรี').items[0].entry.name, 'มหาวิทยาลัยเทคโนโลยีราชมงคลธัญบุรี');
  r = idx.search('ราชภัฏ');
  assert.deepEqual([r.items[0].entry.kind, r.preselect?.kind], ['type', 'type'], 'an institution type is a filter');
  r = idx.search('กำแพงแสน');
  assert.ok(r.items.length >= 1 && r.items.every(i => /กำแพงแสน/.test(i.entry.name)), 'a campus by the place in its name');
});

test('a name typed another way is still found, and a guess is said to be one', () => {
  const {idx} = index();
  let r = idx.search('เชียงใหม');
  assert.deepEqual([top(r, 1)[0], r.items[0].show], ['province:CMI', 'spelling']);
  r = idx.search('จ.เชียงหใม่');
  assert.deepEqual([top(r, 1)[0], r.items[0].show, r.preselect], ['province:CMI', 'near', null]);
  r = idx.search('จุฬาลงกรน์');
  assert.ok(r.items.length && /จุฬาลงกรณ์/.test(r.items[0].entry.name), r.items[0]?.entry.name);
  r = idx.search("g=up'.s,j");
  assert.deepEqual([r.layout, top(r, 1)[0], r.items[0].show, r.preselect], ['เชียงใหม่', 'province:CMI', 'near', null]);
  assert.equal(idx.search('zzzzqqqq').total, 0);
});

test('the list says what an entry is and where; the page opens every kind; the words filter as before', () => {
  const {idx, data} = index();
  const of = (typed, kind) => idx.search(typed).items.find(i => i.entry.kind === kind).entry;
  assert.equal(searchNote(of('ภูเก็ต', 'province')), 'จังหวัด');
  assert.equal(searchNote(of('ราชภัฏ', 'type')), 'ประเภทสถาบัน');
  assert.match(searchNote(of('ธรรมศาสตร์', 'uni')), /^สถาบัน · /);
  assert.equal(searchNote(of('กำแพงแสน', 'site')), 'วิทยาเขต · นครปฐม');
  assert.match(searchNote(of('กำแพงแสน', 'unit')), /^หน่วยรายงาน · /);
  assert.match(searchNote(of('รามคำแหง', 'station')), /^สถานีรถไฟฟ้า · /);
  // No count stands in a row (a rail line's own name may carry a number: “HSR 1”).
  for (const e of searchEntries(index())) { const line = searchNote(e); assert.ok(line && (e.kind === 'station' || !/\d/.test(line)) && !/ ·  ·|^ · | · $/.test(line), `${e.kind} ${e.name}: ${line}`); }
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  for (const k of SEARCH_KINDS) assert.ok(app.includes(`entry.kind === '${k.id}'`), `js/app.js opens a ${k.id}`);
  assert.ok(filterUnits(data.units, {search: 'เกษตรศาสตร์'}).length > 0 && filterSites(data.sites, {search: 'กำแพงแสน'}).length > 0);
  registerDictionary(UNIVERSITY_EN);
  assert.ok(translate(SEARCH_HINT), 'the hint has English');
  const part = {matches: selector => selector === '.find-where'};
  assert.deepEqual(['สถาบัน', 'วิทยาเขต', 'หน่วยรายงาน', 'ประเภทสถาบัน', 'สถานีรถไฟฟ้า', 'จังหวัด'].map(th => translateIn(part, th)), ['Institution', 'Campus', 'Reporting unit', 'Institution type', 'Rail station', 'Province']);
});
