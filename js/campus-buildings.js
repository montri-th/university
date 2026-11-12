/**
 * The drawn buildings that stand in the open campus's extent — lit with the campus (owner 2026-11-12 11:12, VERBATIM:
 * “กรอบมหาลัยโอเคนะ แต่ทำไมไม่แสดงอาคารทั้งหมดในกรอบเวลา highlight”, and for every campus: “apply ทุกมหาลัยได้มั้ย”).
 *
 * A building stands in the extent when the interior point of one of its drawn pieces (js/shell/building-join.js#interiorOf)
 * lies inside the extent — inside an outer ring and outside its holes; every piece of that building is then lit (a
 * building cut by a tile edge lights whole). Buildings are the ones the focus tier draws: OpenStreetMap, or CityMETER
 * Building V4 inside a CityMETER unit. What it is: a building inside the approximate campus extent of OpenStreetMap the
 * research team selected. What it is not: a building the university owns or uses, a faculty building, a count — it is
 * never counted on screen (the number drawn depends on the device's map budget).
 */
import {interiorOf} from './shell/building-join.js';
import {pointInRing} from './shell/geometry.js';

const boxOf = ring => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
};

/** Pure: the polygons of an extent's GeoJSON geometry (Polygon or MultiPolygon) as [{outer, holes, bbox}]. */
export function extentPolygons(geometry) {
  const list = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return list.filter(p => Array.isArray(p?.[0]) && p[0].length >= 4)
    .map(([outer, ...holes]) => ({outer, holes, bbox: boxOf(outer)}));
}

const inside = ([x, y], poly) => {
  const [w, s, e, n] = poly.bbox;
  if (x < w || x > e || y < s || y > n) return false;
  return pointInRing([x, y], poly.outer) && !poly.holes.some(h => pointInRing([x, y], h));
};

/**
 * Pure: the drawn buildings in an extent. pieces: massing footprints [{id, outer, bbox?}]; polygons: extentPolygons();
 * keyOfPiece: Map(piece id → building key) of the join (pieces of one building share a key).
 * → {keys: building keys (first-seen order), refs: every piece id of those buildings}.
 */
export function buildingsInExtent(pieces, polygons, keyOfPiece) {
  const keys = [], seen = new Set();
  if (!pieces?.length || !polygons?.length) return {keys, refs: []};
  const keyOf = p => keyOfPiece?.get(p.id) ?? `piece:${p.id}`;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const {bbox} of polygons) { w = Math.min(w, bbox[0]); s = Math.min(s, bbox[1]); e = Math.max(e, bbox[2]); n = Math.max(n, bbox[3]); }
  for (const p of pieces) {
    if (!Array.isArray(p?.outer) || p.outer.length < 4) continue;
    const b = p.bbox || boxOf(p.outer);
    if (b[2] < w || b[0] > e || b[3] < s || b[1] > n) continue;
    const k = keyOf(p);
    if (seen.has(k)) continue;
    const at = interiorOf(p.outer);
    if (polygons.some(poly => inside(at, poly))) { seen.add(k); keys.push(k); }
  }
  const refs = keys.length ? pieces.filter(p => seen.has(keyOf(p))).map(p => p.id) : [];
  return {keys, refs};
}
