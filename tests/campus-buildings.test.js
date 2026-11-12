import test from 'node:test';
import assert from 'node:assert/strict';
import {extentPolygons, buildingsInExtent} from '../js/campus-buildings.js';

const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const piece = (id, ring, extra = {}) => ({id, outer: ring, ...extra});

test('extentPolygons reads a Polygon and a MultiPolygon, holes kept, broken rings dropped', () => {
  const poly = extentPolygons({type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)]});
  assert.equal(poly.length, 1);
  assert.equal(poly[0].holes.length, 1);
  assert.deepEqual(poly[0].bbox, [0, 0, 10, 10]);
  const multi = extentPolygons({type: 'MultiPolygon', coordinates: [[square(0, 0, 1, 1)], [square(5, 5, 6, 6)], [[[0, 0], [1, 1]]]]});
  assert.equal(multi.length, 2, 'a ring of two points is not a polygon');
  assert.deepEqual(extentPolygons(null), []);
  assert.deepEqual(extentPolygons({type: 'Point', coordinates: [0, 0]}), []);
});

test('buildingsInExtent: a building stands in the extent by the interior point of a piece; holes and the outside stay dark', () => {
  const polygons = extentPolygons({type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)]});
  const pieces = [
    piece(1, square(1, 1, 2, 2)),            // inside
    piece(2, square(4.5, 4.5, 5.5, 5.5)),    // in the hole
    piece(3, square(11, 11, 12, 12)),        // outside (bbox rejected)
    piece(4, square(9, 1, 13, 2)),           // straddles the edge: interior point (11, 1.5) outside
    piece(5, square(8, 8, 10.5, 9)),         // straddles: interior point (9.25, 8.5) inside
  ];
  const r = buildingsInExtent(pieces, polygons, null);
  assert.deepEqual(r.keys, ['piece:1', 'piece:5']);
  assert.deepEqual(r.refs, [1, 5]);
});

test('buildingsInExtent lights every piece of a building one of whose pieces stands inside (tile-cut buildings, parts)', () => {
  const polygons = extentPolygons({type: 'Polygon', coordinates: [square(0, 0, 10, 10)]});
  const pieces = [piece(10, square(8, 1, 9.5, 2)), piece(11, square(10.2, 1, 12, 2)), piece(12, square(20, 20, 21, 21))];
  const keyOfPiece = new Map([[10, 'osm:10'], [11, 'osm:10'], [12, 'osm:12']]);
  const r = buildingsInExtent(pieces, polygons, keyOfPiece);
  assert.deepEqual(r.keys, ['osm:10']);
  assert.deepEqual(r.refs, [10, 11], 'the piece across the tile edge (outside) lights with its building');
});

test('buildingsInExtent: nothing in, nothing lit', () => {
  assert.deepEqual(buildingsInExtent([], extentPolygons({type: 'Polygon', coordinates: [square(0, 0, 1, 1)]}), null), {keys: [], refs: []});
  assert.deepEqual(buildingsInExtent([piece(1, square(0.2, 0.2, 0.4, 0.4))], [], null), {keys: [], refs: []});
});
