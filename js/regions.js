/**
 * Where the map draws buildings in detail (the focus tier of js/massing.js) — pure lon/lat helpers for js/app.js.
 *
 * A campus is drawn with its surroundings (owner 2026-11-12 07:31, VERBATIM: “อาคาร 3 มิติ นอกเขตมหาวิทยาลัยไม่แสดงเลย
 * มันไม่เหมือนกับ demo ของ hotel เลย” and “ในต่างจังหวัดที่อาคาร 3d ของ OSM มีน้อยหรือไม่มี ไม่ได้เอา CityMETER มาเสริมให้”):
 * its extent and a square reaching SITE_CONTEXT_PAD_M past it, at least SITE_CONTEXT_MIN_M from its centre — from
 * CityMETER Building V4 wherever a CityMETER unit holds the ground (data/building-units/, extended round the campuses
 * by scripts/build-campus-units.py with the same two figures). Wherever the reader moves the camera away from the
 * subject, from the focus tier's zoom in, a square CAMERA_REACH_M round the camera, its centre snapped to
 * CAMERA_CELL_M so that a small pan reads nothing new: the focus follows the reader, as the Hotel's district focus does.
 */
export const SITE_CONTEXT_MIN_M = 1000, SITE_CONTEXT_PAD_M = 800;
export const CAMERA_CELL_M = 1500, CAMERA_REACH_M = 3000;

const KY = 110574;
const kx = lat => 111320 * Math.cos((lat * Math.PI) / 180);

/** A square (lon/lat ring) round a point, `metres` from its centre to each side. */
export function squareAround(lon, lat, metres = 250) {
  const dy = metres / KY, dx = metres / kx(lat);
  return [[lon - dx, lat - dy], [lon + dx, lat - dy], [lon + dx, lat + dy], [lon - dx, lat + dy], [lon - dx, lat - dy]];
}

/** [west, south, east, north] of lon/lat rings (no ring → an empty box: west = Infinity). */
export function ringsBox(rings) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}

/**
 * A campus's focus: its extent rings and the square of its surroundings — centred on the extent's box, or on the point
 * of a campus without an extent; nothing for a campus with neither.
 */
export function siteContextRegions(rings = [], point = null) {
  const [w, s, e, n] = ringsBox(rings);
  const boxed = Number.isFinite(w);
  const lon = boxed ? (w + e) / 2 : point?.[0], lat = boxed ? (s + n) / 2 : point?.[1];
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return rings;
  const half = boxed ? Math.max((e - w) * kx(lat), (n - s) * KY) / 2 : 0;
  return [...rings, squareAround(lon, lat, Math.max(SITE_CONTEXT_MIN_M, half + SITE_CONTEXT_PAD_M))];
}

/**
 * The camera's square ({key, ring}) when it looks outside the subject's own focus (`base`, lon/lat rings): from
 * `minZoom` in, snapped to CAMERA_CELL_M; null below that zoom (no building is drawn there, so nothing is read) or
 * while the camera's centre is inside the box of `base`.
 */
export function cameraSquare(center, zoom, {base = [], minZoom = 12} = {}) {
  if (!Array.isArray(center) || !center.every(Number.isFinite) || !(zoom >= minZoom)) return null;
  const [lon, lat] = center;
  if (base.length) {
    const [w, s, e, n] = ringsBox(base);
    if (lon >= w && lon <= e && lat >= s && lat <= n) return null;
  }
  const cx = Math.round((lon * kx(lat)) / CAMERA_CELL_M), cy = Math.round((lat * KY) / CAMERA_CELL_M);
  return {key: `${cx},${cy}`, ring: squareAround((cx * CAMERA_CELL_M) / kx(lat), (cy * CAMERA_CELL_M) / KY, CAMERA_REACH_M)};
}
