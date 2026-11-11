/**
 * The Aha (js/area-insight.js) and the province frames (js/provinces.js). Snapshot numbers here are fixtures of the
 * shipped data (2568/2), never UI constants: the page computes them from the data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {summarizeInsight, topWithoutTie} from '../js/area-insight.js';
import {buildProvinceModel} from '../js/provinces.js';
import {provinces, filterUnits} from '../js/model.js';
import {RAMP_STEPS} from '../js/scales.js';

test('first Aha (snapshot fixture, students): Bangkok, Pathum Thani and Chiang Mai hold 55% of the reported students', () => {
  const {data} = load();
  const i = summarizeInsight(data.units, {metric: 'students', provinces: provinces()});
  assert.equal(i.mode, 'national');
  assert.deepEqual(i.ids, ['BKK', 'PTE', 'CMI']);
  assert.deepEqual(i.items.map(p => p.value), [750679, 147809, 89871]);
  assert.equal(i.total, 1786753);
  assert.equal(Math.round((i.value / i.total) * 100), 55);
  // The open-admission universities report every student under their head office's province: the bar names them.
  assert.ok(i.comparison && i.comparison.total < i.total && i.comparison.value < i.value);
  assert.equal(Math.round((i.comparison.value / i.comparison.total) * 100), 49);
  assert.deepEqual([...i.comparison.excluded].sort(), ['มหาวิทยาลัยรามคำแหง', 'มหาวิทยาลัยสุโขทัยธรรมาธิราช']);
  assert.equal(i.zero.length, 9, 'provinces with no reporting unit (measured zero of this file)');
});

test('the units measure counts reporting paths; it has no open-admission comparison', () => {
  const {data} = load();
  const i = summarizeInsight(data.units, {metric: 'units', provinces: provinces()});
  assert.equal(i.items[0].code, 'BKK');
  assert.equal(i.total, data.units.length);
  assert.equal(i.comparison, null);
});

test('a province Aha names up to three universities among the units the source puts there, with the province total', () => {
  const {data} = load();
  const i = summarizeInsight(data.units, {metric: 'students', province: 'CMI', provinces: provinces()});
  assert.equal(i.mode, 'province');
  assert.ok(i.items.length >= 1 && i.items.length <= 3);
  assert.equal(i.total, data.units.filter(u => u.province === 'CMI').reduce((s, u) => s + u.students, 0));
  assert.ok(i.items.every(x => x.uni && x.value > 0));
  assert.ok(i.value <= i.total && i.nationalTotal === 1786753);
});

test('the focus never cuts through a tie, never takes every item that holds the measure; one item alone is its own finding', () => {
  const v = values => values.map((value, k) => ({id: `x${k}`, value}));
  assert.deepEqual(topWithoutTie(v([9, 8, 7, 6])).map(x => x.value), [9, 8, 7]);
  assert.deepEqual(topWithoutTie(v([9, 8, 7, 7])).map(x => x.value), [9, 8], 'a tie at the cut → fewer');
  assert.deepEqual(topWithoutTie(v([5, 5])).map(x => x.value), [], 'every item tied → none');
  assert.deepEqual(topWithoutTie(v([9, 8, 7])).map(x => x.value), [9, 8], 'never every item that holds the measure');
  assert.deepEqual(topWithoutTie(v([4])).map(x => x.value), [4]);
});

test('the Aha follows the filters: a type, a search', () => {
  const {data} = load();
  const rajabhat = filterUnits(data.units, {type: 'rajabhat'});
  const i = summarizeInsight(rajabhat, {metric: 'students', provinces: provinces()});
  assert.equal(i.total, rajabhat.reduce((s, u) => s + u.students, 0));
  assert.ok(!i.ids.includes('NBI') || rajabhat.some(u => u.province === 'NBI'));
  const none = summarizeInsight([], {metric: 'students', provinces: provinces()});
  assert.equal(none.items.length, 0);
  assert.equal(none.zero.length, 77);
});

test('province frames: EVID-05 — a province with no unit is a measured zero, every frame takes one of the 41 LDS samples', () => {
  const {data, provincesGeo} = load();
  const m = buildProvinceModel(data.units, provincesGeo, {metric: 'students'});
  assert.equal(m.provinces.length, 77);
  assert.equal(m.zeroCount, 9);
  assert.equal(m.ramp.scaleId, 'li.supply');
  assert.equal(RAMP_STEPS, 41);
  for (const p of m.provinces) {
    if (p.value === 0) assert.equal(p.state, 'measured_zero', p.code);
    else assert.ok(m.ramp.lut.includes(p.fill), `${p.code}: an LDS sample`);
  }
  const top = m.provinces.reduce((a, b) => (b.value > a.value ? b : a));
  assert.equal(top.code, 'BKK');
  assert.equal(top.fill, m.ramp.lut[40], 'the highest value closes the ramp');
  assert.equal(buildProvinceModel(data.units, provincesGeo, {metric: 'units'}).ramp.scaleId, 'count');
});
