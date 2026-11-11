import test from 'node:test';
import assert from 'node:assert/strict';
import {terrarium, factsFrom, terrainChips, TERRAIN, hillshadePaint, POSITION_STEP_M, SEA_RINGS, stillScheduler} from '../js/shell/terrain.js';

// Owner 2026-11-01 (point 2): show whether a stay sits by the sea, on a hill, in a valley or among trees — facts of
// the ground only (never a view, a price or a risk), switched on at hilly sites.
test('terrarium decoding and the facts of the ground', () => {
  assert.equal(terrarium(128, 0, 0), 0);
  assert.equal(terrarium(129, 44, 128), 300.5);
  const f = factsFrom({at: 420, ring500: Array(16).fill(380), ring250: Array(8).fill(400)}, {seaBand: 600, treeShare: 0.4166});
  assert.deepEqual([f.elevation, f.relief, f.above, f.position, f.seaBand, f.treeShare], [420, 40, 40, 'higher', 600, 0.42]);
  assert.equal(factsFrom({at: 10, ring500: Array(16).fill(10 + POSITION_STEP_M - 1)}).position, 'level');
  assert.equal(factsFrom({at: null}), null);
  assert.deepEqual(SEA_RINGS[0], 0);
});

test('terrain chips: icon + short text; unknown sea or tree cover is left out, never 0', () => {
  const chips = terrainChips(factsFrom({at: 3, ring500: Array(16).fill(2), ring250: Array(8).fill(3)}, {seaBand: null, treeShare: null}));
  assert.deepEqual(chips.map(c => c.kind), ['elevation']);
  const noWood = terrainChips(factsFrom({at: 3, ring500: Array(16).fill(2), ring250: Array(8).fill(3)}, {seaBand: null, treeShare: 0}));
  assert.ok(!noWood.some(c => c.kind === 'forest'), 'no OSM wood around a stay is not 0 % trees: no chip');
  const all = terrainChips(factsFrom({at: 520, ring500: Array(16).fill(560), ring250: Array(8).fill(540)}, {seaBand: 150, treeShare: 0.3}));
  assert.deepEqual(all.map(c => c.kind), ['elevation', 'relief', 'relief', 'sea', 'forest']);
  assert.ok(all.every(c => c.text.length <= 22 && c.title.length > c.text.length), 'short on the chip, the sentence in the title');
  assert.ok(!all.some(c => /วิว|ราคา|เสี่ยง/.test(c.text + c.title)), 'never a view, a price or a risk');
});

test('terrain changes wait for a still camera (MapLibre 5.6.2 stops rendering when a terrain is set during an ease)', () => {
  const handlers = [];
  const map = {moving: true, isMoving() { return this.moving; }, once(e, h) { if (e === 'moveend') handlers.push(h); }};
  const ticks = [];
  const s = stillScheduler(map, {defer: fn => ticks.push(fn)});
  const ran = [];
  s.run('mode', () => ran.push('on'));
  s.run('refresh', () => ran.push('refresh'));
  s.run('mode', () => ran.push('off'));
  assert.deepEqual(ran, [], 'nothing while the camera moves');
  assert.deepEqual(s.pending, ['mode', 'refresh']);
  assert.equal(handlers.length, 1, 'one wait per move');
  handlers.shift()();
  assert.deepEqual(ran, [], 'a tick after moveend (the instant jumps of a fit end first)');
  map.moving = false; ticks.shift()();
  assert.deepEqual(ran, ['off', 'refresh'], 'the last job per key wins');
  s.run('mode', () => ran.push('now'));
  assert.deepEqual(ran.at(-1), 'now', 'a still camera runs at once');
  map.moving = true; s.run('mode', () => ran.push('later')); s.cancel('mode');
  handlers.shift()(); map.moving = false; ticks.shift()();
  assert.equal(ran.at(-1), 'now', 'a cancelled job never runs');
});
