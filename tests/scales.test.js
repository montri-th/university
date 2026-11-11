import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './helpers.js';
import * as scales from '../js/scales.js';
import {COUNT_SCALE, SUPPLY_SCALE, RAMP_STEPS, classColors, buildCountRamp, buildRamp, buildMetricRamp, scaleFor, rampTicks, rampLegendHTML, needsPlate, classify, inkFor, contrastRatio} from '../js/scales.js';

test('two families, chosen by the measure: li.supply (students, capacity) and count (records); exact 41-sample LUTs, same HEX on both themes', () => {
  assert.equal(SUPPLY_SCALE.scaleId, 'li.supply');
  assert.equal(SUPPLY_SCALE.lut.length, 41);
  assert.deepEqual([SUPPLY_SCALE.lut[0], SUPPLY_SCALE.lut[20], SUPPLY_SCALE.lut[40]], [...SUPPLY_SCALE.anchors]);
  assert.deepEqual([...SUPPLY_SCALE.anchors], ['#EEF6F5', '#87B5D4', '#278E94']);
  assert.equal(SUPPLY_SCALE.scaleVersion, '671112f34b878219faf90fb3fd07cc05a919c134d798ff40fbc8ab278273c497');
  assert.equal(SUPPLY_SCALE.themePolicy, 'identical-light-values-on-both-themes');
  assert.ok(SUPPLY_SCALE.lut.every(h => /^#[0-9A-F]{6}$/.test(h)));
  assert.equal(scaleFor('students'), SUPPLY_SCALE);
  assert.equal(scaleFor('count'), COUNT_SCALE);
  assert.equal(buildMetricRamp([1, 2], {metric: 'students'}).scaleId, 'li.supply');
  assert.equal(buildMetricRamp([1, 2], {metric: 'count'}).scaleId, 'count');
  assert.equal(COUNT_SCALE.lut.length, 41);
  assert.deepEqual([COUNT_SCALE.lut[0], COUNT_SCALE.lut[20], COUNT_SCALE.lut[40]], [...COUNT_SCALE.anchors]);
  assert.deepEqual([...COUNT_SCALE.anchors], ['#F4F0E7', '#7DBAC0', '#213E70']);
  assert.ok(COUNT_SCALE.lut.every(h => /^#[0-9A-F]{6}$/.test(h)));
  assert.equal(COUNT_SCALE.themePolicy, 'identical-light-values-on-both-themes');
  assert.equal(COUNT_SCALE.scaleVersion, '4ff5c1fb4be71ecd13c48685b38371b528bcd4ce369ce964a75354c2eb4d0980');
  assert.deepEqual([COUNT_SCALE.noData, COUNT_SCALE.zeroOutline], ['#D5DAD6', '#7D877F']);
  assert.equal(COUNT_SCALE.scaleId, 'count');
  assert.ok(!('DENSITY_SCALE' in scales), 'no per-area ratio is drawn: recorded students and records are totals, never a density');
});

test('class colours are LUT[round(i·40/(n−1))] for n ∈ {3,5,7,9}; other n are refused', () => {
  for (const n of [3, 5, 7, 9]) assert.deepEqual(classColors(n), Array.from({length: n}, (_, i) => COUNT_SCALE.lut[Math.round((i * 40) / (n - 1))]));
  assert.throws(() => classColors(4), /3, 5, 7 or 9/);
});

test('theme.css carries the count classes once (no dark override of analytical values)', () => {
  const css = readFileSync(join(ROOT, 'assets/theme.css'), 'utf8');
  const [light, dark] = css.split(':root[data-theme="dark"]');
  classColors(5).forEach((hex, i) => assert.match(light, new RegExp(`--scale-count-${i + 1}: ${hex};`)));
  assert.ok(!/--scale-/.test(dark), 'no analytical token is redefined for dark');
  assert.match(light, /--data-no-data: #D5DAD6;/);
  assert.match(light, /--data-zero-outline: #7D877F;/);
});

test('41-sample rank ramp (owner standing rule): each value takes the LUT sample of its mid-rank, lowest on 0, highest on 40', () => {
  assert.equal(RAMP_STEPS, 41);
  const m = buildCountRamp([0, 1, 4, 21]);
  assert.equal(m.method, 'rank');
  assert.equal(m.scaleId, 'count');
  assert.equal(m.steps, 41);
  assert.deepEqual(m.levels.map(l => [l.value, l.index]), [[1, 0], [4, 20], [21, 40]], 'zero is not a level');
  assert.deepEqual(m.levels.map(l => l.fill), [COUNT_SCALE.lut[0], COUNT_SCALE.lut[20], COUNT_SCALE.lut[40]], 'nothing is interpolated: every fill is a LUT sample');
  assert.equal(classify(21, m).index, 40, 'the maximum closes the ramp');
  assert.equal(classify(4, m).fill, COUNT_SCALE.lut[20]);
  assert.equal(classify(1, m).index, 0);
  // Equal values share one sample; one value alone sits on sample 40.
  const tied = buildCountRamp([2, 2, 2, 7]);
  assert.deepEqual(tied.levels.map(l => [l.value, l.areas, l.index]), [[2, 3, 0], [7, 1, 40]]);
  assert.deepEqual(buildCountRamp([3]).levels.map(l => l.index), [40]);
  assert.equal(buildCountRamp([0, 0]).levels.length, 0);
  // EVID-05: measured zero = sample 0 + the zero outline; no data never takes a ramp colour.
  assert.equal(classify(0, m).state, 'measured_zero');
  assert.equal(classify(0, m).fill, COUNT_SCALE.lut[0]);
  assert.equal(classify(0, m).outline, '#7D877F');
  assert.equal(classify(null, m).state, 'no_data');
  assert.equal(classify(null, m).fill, null);
});

test('ramp ticks and legend: all 41 samples in order, ticks at their own samples, zero swatch only when zero occurs', () => {
  const m = buildCountRamp([1, 1, 2, 3, 5, 16, 19, 21, 0]);
  const ticks = rampTicks(m.levels, String);
  assert.equal(ticks[0].index, 0);
  assert.equal(ticks.at(-1).value, 21, 'the highest value always has a tick');
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i].index - ticks[i - 1].index >= 8, 'ticks never crowd');
  const html = rampLegendHTML(m, {zero: true, zeroTitle: '0 ของชุดข้อมูลนี้'});
  const cells = [...html.matchAll(/<i style="background:(#[0-9A-F]{6})" data-step="(\d+)"><\/i>/g)];
  assert.equal(cells.length, 41);
  assert.deepEqual(cells.map(c => c[1]), [...COUNT_SCALE.lut]);
  assert.match(html, /aria-label="41 ระดับสีตามลำดับค่า ต่ำสุด 1 สูงสุด 21 แห่ง"/);
  assert.match(html, /ramp-zero/);
  assert.ok(!/ramp-zero/.test(rampLegendHTML(m)), 'no zero swatch unless asked');
  assert.equal(rampLegendHTML(buildCountRamp([])), '');
});

test('label ink is the foundation pair with the higher contrast; a number on a sample neither ink reads on sits on a plate', () => {
  for (const hex of COUNT_SCALE.lut) {
    const ink = inkFor(hex), other = ink === '#182327' ? '#FFFFFF' : '#182327';
    assert.ok(contrastRatio(hex, ink) >= contrastRatio(hex, other));
    assert.ok(contrastRatio(hex, ink) >= 4.5 || needsPlate(hex), hex);
  }
  assert.deepEqual(COUNT_SCALE.lut.map((h, i) => (needsPlate(h) ? i : -1)).filter(i => i >= 0), [27, 28, 29]);
  const m = buildCountRamp(Array.from({length: 41}, (_, i) => i + 1));
  assert.equal(classify(29, m).plate, true, 'sample 28 carries a plate');
  assert.equal(classify(41, m).plate, false);
});

test('ramp tick labels never touch on the narrowest legend (0.3.5: “11,026” sat on “153,200” on a phone)', async () => {
  const {RAMP_MIN_WIDTH, tickLabelWidth} = await import('../js/scales.js');
  const fmt = v => v.toLocaleString('en-US');
  const sets = [
    [1104, 1500, 2000, 2600, 3200, 3821, 4300, 5000, 5800, 6785, 7500, 8200, 9000, 11026, 15000, 20000, 28656, 30000, 49107, 50000, 93098, 153200],
    [4, 20, 60, 179, 300, 549, 1000, 5000, 12000, 62561],
    [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711],
  ];
  for (const values of sets) {
    const m = buildRamp(values, {scale: SUPPLY_SCALE});
    const ticks = rampTicks(m.levels, fmt);
    assert.equal(ticks[0].value, Math.min(...values), 'the lowest value keeps its tick');
    assert.equal(ticks.at(-1).value, Math.max(...values), 'the highest value keeps its tick');
    const per = RAMP_MIN_WIDTH / RAMP_STEPS;
    const box = t => { const x = (t.index + 0.5) * per, w = tickLabelWidth(t.label); return t.index <= 2 ? [x - 2, x - 2 + w] : t.index >= 38 ? [x + 2 - w, x + 2] : [x - w / 2, x + w / 2]; };
    for (let i = 1; i < ticks.length; i++) assert.ok(box(ticks[i - 1])[1] + 5 <= box(ticks[i])[0], `${ticks[i - 1].label} and ${ticks[i].label} keep apart`);
  }
});
