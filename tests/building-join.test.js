import test from 'node:test';
import assert from 'node:assert/strict';
import {joinRows, containsPoint, footprint, groupPieces, joinBuildings, nearestBuilding, buildingsAtPoints} from '../js/shell/building-join.js';

// Synthetic footprints near Din Daeng (lon/lat squares; d = half-size in degrees).
const square = (cx, cy, d) => [[cx - d, cy - d], [cx + d, cy - d], [cx + d, cy + d], [cx - d, cy + d], [cx - d, cy - d]];
const X = 100.56, Y = 13.765;
const row = (id, dx, dy) => ({id, name: id, longitude: X + dx, latitude: Y + dy});

test('a published point joins the smallest drawn footprint that contains it; holes and the outside join nothing', () => {
  const outline = {key: 'osm:1', kind: 'osm', outer: square(X, Y, 0.001), holes: [square(X + 0.0007, Y + 0.0007, 0.0001)]};
  const part = {key: 'osm:2', kind: 'osm', outer: square(X - 0.0004, Y, 0.0002)};
  const rows = [row('in-part', -0.0004, 0), row('in-outline', 0.0004, -0.0004), row('in-hole', 0.0007, 0.0007), row('outside', 0.003, 0), {id: 'no-point', longitude: null, latitude: null}];
  const j = joinRows([outline, part], rows);
  assert.equal(j.byRow.get('in-part'), 'osm:2', 'a part inside an outline wins (smallest)');
  assert.equal(j.byRow.get('in-outline'), 'osm:1');
  assert.ok(!j.byRow.has('in-hole'), 'a courtyard (hole) is not inside');
  assert.ok(!j.byRow.has('outside') && !j.byRow.has('no-point'), 'rows without a point never join');
  assert.deepEqual(j.byBuilding.get('osm:1').map(r => r.id), ['in-outline']);
  assert.ok(containsPoint(footprint(part), [X - 0.0004, Y]) && !containsPoint(footprint(part), [X, Y]));
});

test('several points in one building stay several rows (the building panel lists them); the join never changes membership', () => {
  const b = {key: 'osm:9', kind: 'osm', outer: square(X, Y, 0.0005)};
  const rows = [row('a', 0, 0), row('b', 0.0001, 0.0001), row('c', -0.0001, 0)].map(r => ({...r, area: '102601'}));
  const before = JSON.stringify(rows);
  const j = joinRows([b], rows);
  assert.deepEqual(j.byBuilding.get('osm:9').map(r => r.id).sort(), ['a', 'b', 'c']);
  assert.equal(JSON.stringify(rows), before, 'rows are not mutated (area membership stays the matched code)');
  assert.equal(joinRows([], rows).byRow.size, 0);
});

// Pieces of buildings cut by a z14 tile edge (the focus tier clips every building to its tile).
const Z = 14;
const tileX = lon => Math.floor(((lon + 180) / 360) * 2 ** Z);
const tileY = lat => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z); };
const lonOf = x => (x / 2 ** Z) * 360 - 180;
const latOf = y => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;
const box = (w, s, e, n) => [[w, n], [e, n], [e, s], [w, s], [w, n]];

test('pieces of one building cut by a tile edge are one building; the same OSM id elsewhere is not', () => {
  const x = tileX(100.56), y = tileY(13.765);
  const E = lonOf(x + 1), mid = (latOf(y) + latOf(y + 1)) / 2;
  const a = {id: 1, osmId: 77, outer: box(E - 0.0005, mid - 0.0002, E, mid + 0.0002), tile: {x, y, z: Z}};
  // The neighbour tile quantises the same outline on its own grid: its cut points sit ≈ 0.3 m away.
  const b = {id: 2, osmId: 77, outer: box(E, mid - 0.0002 + 3e-6, E + 0.0003, mid + 0.0002 + 3e-6), tile: {x: x + 1, y, z: Z}};
  // Same id (OpenFreeMap merges equal-height buildings per tile), on the same edge but 400 m north: another building.
  const c = {id: 3, osmId: 77, outer: box(E, mid + 0.0036, E + 0.0002, mid + 0.004), tile: {x: x + 1, y, z: Z}};
  // Same id, not on any tile edge.
  const d = {id: 4, osmId: 77, outer: box(E + 0.001, mid - 0.0002, E + 0.0012, mid), tile: {x: x + 1, y, z: Z}};
  const g = groupPieces([a, b, c, d]);
  assert.equal(g.get(1), 1); assert.equal(g.get(2), 1, 'b joins a across the edge');
  assert.equal(g.get(3), 3, 'a merged id alone never joins buildings');
  assert.equal(g.get(4), 4);
  // Without an OSM id nothing is grouped.
  assert.equal(groupPieces([{...a, osmId: null}, {...b, osmId: null}]).get(2), 2);
});

test('joinBuildings: one key per building, rows of every piece in one list, and the venue whose registry point falls in it', () => {
  const x = tileX(100.56), y = tileY(13.765);
  const E = lonOf(x + 1), mid = (latOf(y) + latOf(y + 1)) / 2;
  const a = {id: 11, osmId: 5, outer: box(E - 0.0005, mid - 0.0002, E, mid + 0.0002), holes: [], height: 30, tile: {x, y, z: Z}};
  const b = {id: 12, osmId: 5, outer: box(E, mid - 0.0002, E + 0.0003, mid + 0.0002), holes: [], height: 42, tile: {x: x + 1, y, z: Z}};
  const other = {id: 13, osmId: 6, outer: box(E - 0.002, mid - 0.0002, E - 0.0015, mid + 0.0002), holes: [], height: 9, tile: {x, y, z: Z}};
  const rows = [{id: 'r1', longitude: E - 0.0002, latitude: mid}, {id: 'r2', longitude: E + 0.0001, latitude: mid}, {id: 'r3', longitude: E - 0.0017, latitude: mid}];
  const venues = [{id: 'v1', longitude: E + 0.0002, latitude: mid + 0.0001}, {id: 'v2', longitude: E + 0.01, latitude: mid}];
  const j = joinBuildings([a, b, other], rows, venues);
  const key = j.byRow.get('r1');
  assert.equal(key, 'osm:11');
  assert.equal(j.byRow.get('r2'), key, 'a point in the other piece is in the same building');
  assert.deepEqual(j.byBuilding.get(key).map(r => r.id), ['r1', 'r2']);
  assert.deepEqual(j.buildings.get(key).refs.sort(), [11, 12], 'every piece is highlighted, x-rayed and framed');
  assert.equal(j.buildings.get(key).height, 42);
  assert.equal(j.byRow.get('r3'), 'osm:13');
  assert.equal(j.byVenue.get('v1'), key);
  assert.deepEqual(j.venuesByBuilding.get(key).map(v => v.id), ['v1']);
  assert.ok(!j.byVenue.has('v2'), 'a venue point in no drawn building joins nothing');
  assert.equal(j.keyOfPiece.get(12), key);
});

test('building:parts inside an outline hidden in 3D are one building; parts standing at one point are one building', () => {
  const x = tileX(100.56), y = tileY(13.765);
  const W = lonOf(x), mid = (latOf(y) + latOf(y + 1)) / 2, t = {x, y, z: Z};
  const L = W + 0.004; // well inside the tile
  const outline = {id: 50, osmId: 9, outer: box(L, mid - 0.0004, L + 0.0008, mid + 0.0004), holes: [], height: 0, tile: t, outline: true};
  const podium = {id: 51, osmId: 10, outer: box(L, mid - 0.0004, L + 0.0008, mid), holes: [], height: 20, tile: t};
  const tower = {id: 52, osmId: 11, outer: box(L + 0.0002, mid, L + 0.0005, mid + 0.0003), holes: [], height: 150, tile: t};
  const neighbour = {id: 53, osmId: 12, outer: box(L + 0.0012, mid - 0.0002, L + 0.0016, mid + 0.0002), holes: [], height: 30, tile: t};
  const g = groupPieces([outline, podium, tower, neighbour]);
  assert.equal(g.get(51), 50); assert.equal(g.get(52), 50, 'parts inside the outline join it');
  assert.equal(g.get(53), 53, 'a building outside the outline stays apart');
  // No outline: a separately drawn podium and tower that both hold the venue point are one building.
  const venue = {id: 'v', longitude: L + 0.0003, latitude: mid - 0.0001};
  const lowTower = {...tower, outer: box(L + 0.0002, mid - 0.0002, L + 0.0005, mid + 0.0003)};
  const j = joinBuildings([podium, lowTower, neighbour], [], [venue]);
  const key = j.byVenue.get('v');
  assert.deepEqual(j.buildings.get(key).refs.sort(), [51, 52], 'podium and tower are framed and x-rayed together');
  assert.equal(j.buildings.get(key).height, 150);
  // With the outline the venue point joins the same group however the parts are drawn.
  const k2 = joinBuildings([outline, podium, tower, neighbour], [], [venue]);
  assert.deepEqual(k2.buildings.get(k2.byVenue.get('v')).refs.sort(), [50, 51, 52]);
});

test('nearestBuilding: a pin in no outline turns the camera to the drawn building nearest it — the largest within the slack, never past the reach', () => {
  // Metres → degrees at this latitude.
  const mx = 1 / (111320 * Math.cos((Y * Math.PI) / 180)), my = 1 / 110574;
  const box = (id, cx, cy, half) => ({id, outer: square(X + cx * mx, Y + cy * my, 0).map(([x, y], i) => [x + [-1, 1, 1, -1, -1][i] * half * mx, y + [-1, -1, 1, 1, -1][i] * half * my])});
  const kiosk = box(1, 6, 0, 2);       // 4 m wide, its edge 4 m from the pin
  const block = box(2, 0, 20, 10);     // 20 m wide, its edge 10 m from the pin
  const far = box(3, 0, -200, 10);     // 190 m away
  const keyOfPiece = new Map([[1, 'cm:1'], [2, 'cm:2'], [3, 'cm:3']]);
  const n = nearestBuilding([kiosk, block, far], [X, Y], {keyOfPiece});
  assert.equal(n.key, 'cm:2', 'within 10 m of the nearest, the largest footprint (the school block, not the kiosk)');
  assert.ok(Math.abs(n.distanceM - 10) < 0.5, `${n.distanceM}`);
  assert.equal(nearestBuilding([kiosk, block, far], [X, Y], {keyOfPiece, slackM: 0}).key, 'cm:1', 'no slack: the nearest itself');
  assert.equal(nearestBuilding([far], [X, Y], {keyOfPiece, maxM: 100}), null, 'nothing within the reach');
  assert.equal(nearestBuilding([far], [X, Y], {keyOfPiece, maxM: 300}).key, 'cm:3', 'a wider reach finds it');
  // A pin in a courtyard measures to the courtyard's edges; a pin inside an outline is at 0 m.
  const ring = {id: 4, outer: box(0, 0, 0, 30).outer, holes: [box(0, 0, 0, 10).outer]};
  assert.ok(Math.abs(nearestBuilding([ring], [X, Y], {keyOfPiece: new Map([[4, 'osm:4']])}).distanceM - 10) < 0.5);
  assert.equal(nearestBuilding([block], [X, Y + 20 * my]).distanceM, 0);
  assert.equal(nearestBuilding([], [X, Y]), null);
  assert.equal(nearestBuilding([block], [NaN, Y]), null);
});

test('buildingsAtPoints: a site (49_SITE_BOUNDARY_CHECK) shows every drawn building holding one of its points, every piece of each — never a neighbour', () => {
  const mx = 1 / (111320 * Math.cos((Y * Math.PI) / 180)), my = 1 / 110574;
  const box = (id, cx, cy, half) => ({id, outer: square(X + cx * mx, Y + cy * my, 0).map(([x, y], i) => [x + [-1, 1, 1, -1, -1][i] * half * mx, y + [-1, -1, 1, 1, -1][i] * half * my])});
  const lobby = box(1, 0, 0, 10), wingA = box(2, 40, 0, 8), wingB = box(3, 52, 0, 4); // one wing cut in two pieces
  const villa = box(4, 0, 60, 5), neighbour = box(5, 0, -40, 10);
  const court = {id: 6, outer: box(6, 100, 0, 20).outer, holes: [box(0, 100, 0, 6).outer]};
  const keyOfPiece = new Map([[1, 'cm:1'], [2, 'cm:2'], [3, 'cm:2'], [4, 'cm:4'], [5, 'cm:5'], [6, 'cm:6']]);
  const at = (cx, cy) => [X + cx * mx, Y + cy * my];
  const pieces = [lobby, wingA, wingB, villa, neighbour, court];
  const site = buildingsAtPoints(pieces, [at(40, 0), at(0, 0), at(0, 61), at(1, 1), at(0, -55), at(100, 0), [NaN, Y]], keyOfPiece);
  assert.deepEqual(site.keys, ['cm:2', 'cm:1', 'cm:4'], 'in point order, each building once');
  assert.deepEqual(site.refs.sort(), [1, 2, 3, 4], 'every piece of the wing, so it is framed and x-rayed whole');
  assert.equal(site.held, 4, 'a point 5 m past the neighbour, in a courtyard or not a number finds nothing');
  assert.ok(!site.keys.includes('cm:5') && !site.keys.includes('cm:6'), 'a point outside every outline is never snapped to the nearest');
  assert.deepEqual(buildingsAtPoints(pieces, [at(0, 0)]).keys, ['piece:1'], 'without the join, a piece stands for itself');
  assert.deepEqual(buildingsAtPoints([], [at(0, 0)], keyOfPiece), {keys: [], refs: [], held: 0}, 'tiles still loading: nothing yet');
  assert.deepEqual(buildingsAtPoints(pieces, [], keyOfPiece), {keys: [], refs: [], held: 0});
});
