// Building camera (owner instruction 2026-10-29 19:47 for Fitness, the Shopping centers venue camera of 2026-10-25):
// two-point perspective of the building being looked at, zoomed to fit the free part of the map. The fit is tested against a pinhole camera with MapLibre's
// conventions (512-px tiles, principal point at the centre of the area inside the padding, pitch from the
// nadir, bearing clockwise from north), so the algorithm is checked without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {wallAzimuth, twoPointBearing, occlusionScore, fitBuilding, screenBounds, CAMERA} from '../js/shell/camera.js';

const RAD = Math.PI / 180;
const LON = 100.544, LAT = 13.744;
const KX = 111320 * Math.cos(LAT * RAD), KY = 110574;
/** Ring of a w × d metre rectangle centred at (LON, LAT), its long side at compass azimuth `az`. */
function rect(w, d, az, [cx, cy] = [0, 0]) {
  const a = az * RAD, ux = [Math.sin(a), Math.cos(a)], vx = [Math.cos(a), -Math.sin(a)];
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  return pts.map(([s, t]) => [LON + (cx + s * ux[0] + t * vx[0]) / KX, LAT + (cy + s * ux[1] + t * vx[1]) / KY]);
}

/**
 * Pinhole map: what fitBuilding reads and writes, nothing else. `terrain(lng, lat)` (metres, as drawn) lifts every
 * point by the ground under it and the camera orbits its centre at `elevation`, as MapLibre does on terrain.
 */
function fakeMap({width = 390, height = 640, terrain = null, lift = false} = {}) {
  const cam = {center: {lng: LON + 0.01, lat: LAT - 0.01}, zoom: 13, pitch: 56, bearing: 28, fov: 36.87, padding: {top: 0, bottom: 0, left: 0, right: 0}, elevation: 0};
  const moves = [];
  const geometry = () => {
    const f = (height / 2) / Math.tan((cam.fov / 2) * RAD);
    const ppm = (512 * 2 ** cam.zoom) / (40075016.686 * Math.cos(cam.center.lat * RAD));
    return {f, D: f / ppm, p: cam.pitch * RAD, b: cam.bearing * RAD, kx: 111320 * Math.cos(cam.center.lat * RAD)};
  };
  // The principal point: the centre of the area inside the padding, as MapLibre shifts its projection (centerOffset).
  const principal = () => [cam.padding.left + (width - cam.padding.left - cam.padding.right) / 2, cam.padding.top + (height - cam.padding.top - cam.padding.bottom) / 2];
  // Altitude above sea level as drawn (no ground lookup); project3 adds the ground under the point.
  const projectAbs3 = ([lng, lat, abs = 0]) => {
    const {f, D, p, b, kx} = geometry();
    const e = (lng - cam.center.lng) * kx, n = (lat - cam.center.lat) * KY;
    const x = e * Math.cos(b) - n * Math.sin(b), y = e * Math.sin(b) + n * Math.cos(b);
    const h = abs - cam.elevation; // above the centre the camera orbits
    const z = y * Math.sin(p) - h * Math.cos(p) + D, v = y * Math.cos(p) + h * Math.sin(p);
    if (!(z > 1)) return {x: NaN, y: NaN};
    const [px, py] = principal();
    return {x: px + (f * x) / z, y: py - (f * v) / z};
  };
  const project3 = ([lng, lat, alt = 0]) => {
    const {f, D, p, b, kx} = geometry();
    const e = (lng - cam.center.lng) * kx, n = (lat - cam.center.lat) * KY;
    const x = e * Math.cos(b) - n * Math.sin(b), y = e * Math.sin(b) + n * Math.cos(b);
    const h = alt + (terrain ? terrain(lng, lat) : 0) - cam.elevation; // above the centre the camera orbits
    const z = y * Math.sin(p) - h * Math.cos(p) + D, v = y * Math.cos(p) + h * Math.sin(p);
    if (!(z > 1)) return {x: NaN, y: NaN};
    const [px, py] = principal();
    return {x: px + (f * x) / z, y: py - (f * v) / z};
  };
  // MapLibre 5.6.2 Map#_elevateCameraIfInsideTerrain, run by every camera change: a camera below the ground under it is
  // raised to that ground over the same spot, still looking at the centre — a lower pitch and a lower zoom.
  const elevateCameraIfInsideTerrain = () => {
    const {f, D, p, b, kx} = geometry();
    const back = D * Math.sin(p);
    const ground = terrain(cam.center.lng - (back * Math.sin(b)) / kx, cam.center.lat - (back * Math.cos(b)) / KY);
    if (cam.elevation + D * Math.cos(p) >= ground) return {};
    const up = ground - cam.elevation;
    return {pitch: Math.atan2(back, up) / RAD, zoom: Math.log2(((f / Math.hypot(back, up)) * 40075016.686 * Math.cos(cam.center.lat * RAD)) / 512)};
  };
  const map = {
    width, height, moves,
    getCenter: () => ({...cam.center}), getZoom: () => cam.zoom, getPitch: () => cam.pitch, getBearing: () => cam.bearing, getPadding: () => ({...cam.padding}),
    getVerticalFieldOfView: () => cam.fov, setVerticalFieldOfView: v => { cam.fov = v; },
    jumpTo(o) {
      if (o.center) cam.center = Array.isArray(o.center) ? {lng: o.center[0], lat: o.center[1]} : {lng: o.center.lng, lat: o.center.lat};
      for (const k of ['zoom', 'pitch', 'bearing', 'elevation']) if (o[k] != null) cam[k] = o[k];
      if (o.padding) cam.padding = {...o.padding};
      if (lift) {
        const raised = map._elevateCameraIfInsideTerrain(cam);
        if (raised.pitch != null) { cam.pitch = raised.pitch; cam.zoom = raised.zoom; }
      }
    },
    easeTo(o) { moves.push(['ease', o]); map.jumpTo(o); },
    flyTo(o) { moves.push(['fly', o]); map.jumpTo(o); },
    project: ([lng, lat]) => project3([lng, lat, 0]),
    unproject([sx, sy]) {
      const {f, D, p, b, kx} = geometry();
      const [px, py] = principal();
      const X = (sx - px) / f, Yv = (py - sy) / f;
      const y = (Yv * D) / (Math.cos(p) - Yv * Math.sin(p));
      const x = X * (y * Math.sin(p) + D);
      const e = x * Math.cos(b) + y * Math.sin(b), n = -x * Math.sin(b) + y * Math.cos(b);
      return {lng: cam.center.lng + e / kx, lat: cam.center.lat + n / KY};
    },
  };
  if (lift) map._elevateCameraIfInsideTerrain = elevateCameraIfInsideTerrain;
  if (terrain) {
    map.terrain = {};
    map.queryTerrainElevation = ([lng, lat]) => terrain(lng, lat);
    map.transform = {get elevation() { return cam.elevation; }};
    // MapLibre clamps the centre to the ground once the camera lands (centerClampedToGround).
    map.land = () => { cam.elevation = terrain(cam.center.lng, cam.center.lat); };
  }
  return {map, project: (_, q) => project3(q), projectAbs: (_, q) => projectAbs3(q)};
}

test('wall direction: a rectangle reads its long side, walls 90° apart count as one direction', () => {
  assert.ok(Math.abs(wallAzimuth([rect(120, 40, 20)]) - 20) < 0.01);
  assert.ok(Math.abs(wallAzimuth([rect(40, 120, 20)]) - 20) < 0.01, 'the short side gives the same family');
  assert.ok(Math.abs(wallAzimuth([rect(80, 60, 75)]) - 75) < 0.01);
  assert.equal(wallAzimuth([]), null);
});

test('two-point bearing: corner-on (wall + 45°), the diagonal nearest the current bearing', () => {
  const ring = [rect(120, 40, 20)];
  assert.equal(twoPointBearing(ring, 0), -25);
  assert.equal(twoPointBearing(ring, 50), 65);
  assert.equal(twoPointBearing(ring, 170), 155);
  const b = twoPointBearing(ring, 28);
  const fromWall = ((b - 20) % 90 + 90) % 90;
  assert.equal(fromWall, 45, 'always 45° off the walls: two faces, two vanishing points');
  assert.equal(twoPointBearing([], 33), 33, 'no wall → keep the bearing');
});

test('fit: the building fills the free box — centred, one side touching, the other inside — under the eye camera', () => {
  const {map, project} = fakeMap();
  const podium = rect(110, 70, 20), tower = rect(36, 30, 20, [20, 5]);
  const points = [...podium.flatMap(([a, b]) => [[a, b, 0], [a, b, 22]]), ...tower.flatMap(([a, b]) => [[a, b, 0], [a, b, 85]])];
  const box = {left: 12, top: 70, right: 330, bottom: 470};
  const bearing = twoPointBearing([podium, tower], map.getBearing());
  const target = fitBuilding(map, points, {box, bearing, project, animate: false});
  assert.equal(target.pitch, CAMERA.eye.pitch);
  assert.equal(target.bearing, bearing);
  // Shift lens (0.3.2): the principal point at the free box's centre, never below the canvas centre (horizon out).
  const p = target.padding;
  assert.equal(p.top, 0, 'never moved down');
  assert.ok(Math.abs(p.left + (map.width - p.left - p.right) / 2 - (box.left + box.right) / 2) <= 0.5, 'across: the box centre');
  assert.ok(Math.abs((map.height - p.bottom) / 2 - (box.top + box.bottom) / 2) <= 0.5, 'down: the box centre');
  assert.ok(CAMERA.eye.pitch + CAMERA.eye.fov / 2 < 90);
  const b = screenBounds(map, points, project);
  const tw = (box.right - box.left) * 0.94, th = (box.bottom - box.top) * 0.94;
  assert.ok(Math.abs((b.minX + b.maxX) / 2 - (box.left + box.right) / 2) < 1.5, 'centred across');
  assert.ok(Math.abs((b.minY + b.maxY) / 2 - (box.top + box.bottom) / 2) < 1.5, 'centred down');
  const fillW = (b.maxX - b.minX) / tw, fillH = (b.maxY - b.minY) / th;
  assert.ok(Math.abs(Math.max(fillW, fillH) - 1) < 0.01, `fills one side (${fillW.toFixed(3)} × ${fillH.toFixed(3)})`);
  assert.ok(Math.min(fillW, fillH) <= 1.001, 'the other side fits');
});

test('fit (0.3.2): the shift lens moves the principal point up to a high free box (a phone above its sheet), never down', () => {
  const {map, project} = fakeMap({width: 390, height: 652});
  const block = rect(60, 40, 0);
  const points = block.flatMap(([a, b]) => [[a, b, 0], [a, b, 15]]);
  const strip = {left: 12, top: 54, right: 343, bottom: 194};
  const target = fitBuilding(map, points, {box: strip, bearing: 30, project, animate: false, maxZoom: 21});
  assert.deepEqual(target.padding, {top: 0, bottom: 404, left: 0, right: 35});
  assert.equal(target.pitch, CAMERA.eye.pitch);
  const b = screenBounds(map, points, project);
  assert.ok(b.minX >= strip.left - 1 && b.maxX <= strip.right + 1 && b.minY >= strip.top - 1 && b.maxY <= strip.bottom + 1, `inside the strip: ${JSON.stringify(b)}`);
  // A box under the canvas centre: the lens stays at the centre (the top edge would pass the horizon).
  const low = fitBuilding(map, points, {box: {left: 0, top: 400, right: 390, bottom: 640}, bearing: 30, project, apply: false, maxZoom: 21});
  assert.equal(low.padding.top, 0);
  assert.equal(low.padding.bottom, 0);
});

test('fit: a tiny building stops at the zoom limit and stays centred; the start camera animates to the target', () => {
  const {map, project} = fakeMap({width: 1200, height: 800});
  const kiosk = rect(4, 4, 0);
  const points = kiosk.flatMap(([a, b]) => [[a, b, 0], [a, b, 3]]);
  const box = {left: 24, top: 80, right: 1120, bottom: 700};
  const before = map.getZoom();
  const target = fitBuilding(map, points, {box, bearing: 45, project, maxZoom: 19.5});
  assert.equal(target.zoom, 19.5);
  assert.equal(map.moves.length, 1, 'one animation');
  assert.equal(map.moves[0][0], 'fly', 'a big zoom change flies');
  assert.notEqual(before, target.zoom);
  const b = screenBounds(map, points, project);
  assert.ok(Math.abs((b.minX + b.maxX) / 2 - (box.left + box.right) / 2) < 1.5);
});

test('fit on terrain (owner 2026-11-01: buildings on the ground): the landed camera — centre clamped to the ground — frames the building as drawn on a hillside', () => {
  // A resort on a 20 % slope 40–70 m up (as drawn, exaggerated): the ground rises to the north.
  const terrain = (lng, lat) => 55 + 0.2 * (lat - LAT) * KY;
  const {map, project, projectAbs} = fakeMap({terrain});
  const podium = rect(70, 40, 20), tower = rect(24, 20, 20, [10, 5]);
  const points = [...podium.flatMap(([a, b]) => [[a, b, 0], [a, b, 12]]), ...tower.flatMap(([a, b]) => [[a, b, 0], [a, b, 30]])];
  // MapLibre lifts each extrusion by the ground at its centroid: the building as drawn.
  const anchor = [points.filter(q => !q[2]).reduce((s, q) => s + q[0], 0) / points.filter(q => !q[2]).length, points.filter(q => !q[2]).reduce((s, q) => s + q[1], 0) / points.filter(q => !q[2]).length];
  const drawn = points.map(q => [q[0], q[1], q[2] + terrain(...anchor)]);
  const box = {left: 12, top: 70, right: 330, bottom: 470};
  const startElevation = map.transform.elevation;
  const computed = fitBuilding(map, points, {box, bearing: 45, project, projectAbs, apply: false});
  assert.equal(map.transform.elevation, startElevation, 'the start camera (with its elevation) is restored after the computation');
  const target = fitBuilding(map, points, {box, bearing: 45, project, projectAbs, animate: false});
  assert.deepEqual(target, computed);
  assert.ok(Math.abs(target.elevation - terrain(target.center.lng, target.center.lat)) < 0.1, 'the target carries the ground under its centre');
  assert.equal(map.transform.elevation, target.elevation, 'an instant jump lands there');
  map.land();
  assert.ok(Math.abs(map.transform.elevation - terrain(target.center.lng, target.center.lat)) < 1e-9);
  const b = screenBounds(map, drawn, (_, q) => projectAbs(map, q));
  const tw = (box.right - box.left) * 0.94, th = (box.bottom - box.top) * 0.94;
  assert.ok(Math.abs((b.minX + b.maxX) / 2 - (box.left + box.right) / 2) < 2, `centred across (${((b.minX + b.maxX) / 2).toFixed(1)})`);
  assert.ok(Math.abs((b.minY + b.maxY) / 2 - (box.top + box.bottom) / 2) < 2, `centred down (${((b.minY + b.maxY) / 2).toFixed(1)})`);
  const fillW = (b.maxX - b.minX) / tw, fillH = (b.maxY - b.minY) / th;
  assert.ok(Math.abs(Math.max(fillW, fillH) - 1) < 0.02, `fills one side (${fillW.toFixed(3)} × ${fillH.toFixed(3)})`);
  // The same building fitted as if the ground were at sea level lands off the frame once the scene stands on the hill.
  const flat = fakeMap();
  const t2 = fitBuilding(flat.map, points, {box, bearing: 45, project: flat.project, animate: false});
  const hill = fakeMap({terrain});
  hill.map.jumpTo({...t2}); hill.map.land();
  const off = screenBounds(hill.map, drawn, (_, q) => hill.projectAbs(hill.map, q));
  assert.ok(Math.abs((off.minY + off.maxY) / 2 - (box.top + box.bottom) / 2) > 2 || Math.abs((off.minX + off.maxX) / 2 - (box.left + box.right) / 2) > 2 || Math.abs(Math.max((off.maxX - off.minX) / tw, (off.maxY - off.minY) / th) - 1) > 0.02,
    'ignoring the ground would frame it differently');
});

test('fit on terrain (0.3.2): a point carrying its own ground (4th value) is framed where it is drawn — a small building down the slope from the pin', () => {
  // A 12 m villa 30 m south of (down the slope from) the pin on a 30 % slope: drawn at the ground of its own centroid.
  const terrain = (lng, lat) => 60 + 0.3 * (lat - LAT) * KY;
  const {map, project, projectAbs} = fakeMap({terrain});
  const villa = rect(12, 12, 6, [0, -30]);
  const centroid = [villa.slice(0, -1).reduce((s, q) => s + q[0], 0) / 4, villa.slice(0, -1).reduce((s, q) => s + q[1], 0) / 4];
  const g = terrain(...centroid), pin = [LON, LAT];
  const points = [...villa.flatMap(([a, b]) => [[a, b, 0, g], [a, b, 6, g]]), [pin[0], pin[1], 0, terrain(...pin)]];
  const drawn = [...villa.flatMap(([a, b]) => [[a, b, g], [a, b, 6 + g]]), [pin[0], pin[1], terrain(...pin)]];
  const box = {left: 12, top: 70, right: 330, bottom: 470};
  const target = fitBuilding(map, points, {box, bearing: 30, project, projectAbs, animate: false, maxZoom: 21});
  map.jumpTo({...target}); map.land();
  const b = screenBounds(map, drawn, (_, q) => projectAbs(map, q));
  assert.ok(b.minX >= box.left - 2 && b.maxX <= box.right + 2 && b.minY >= box.top - 2 && b.maxY <= box.bottom + 2, `inside the box: ${JSON.stringify(b)}`);
  assert.ok(Math.abs((b.minY + b.maxY) / 2 - (box.top + box.bottom) / 2) < 3, `centred down (${((b.minY + b.maxY) / 2).toFixed(1)})`);
});

test('fit on terrain (0.3.2): a camera lifted out of the hill behind it early in the fit is not kept — the frame is computed and applied at the eye pitch', () => {
  // Phone: the free box is the strip above the sheet, so the camera stands far back. A ridge rises 600 m south of a
  // 60 × 40 m school block (45°, as drawn): the first, wide camera stands in it, the fitted one does not.
  const terrain = (lng, lat) => 40 + Math.max(0, -(lat - LAT) * KY - 600);
  const {map, projectAbs} = fakeMap({width: 390, height: 652, terrain, lift: true});
  const block = rect(60, 40, 0);
  const points = block.flatMap(([a, b]) => [[a, b, 0, 40], [a, b, 15, 40]]);
  const drawn = block.flatMap(([a, b]) => [[a, b, 40], [a, b, 55]]);
  const box = {left: 12, top: 54, right: 343, bottom: 194};
  const check = map._elevateCameraIfInsideTerrain;
  const target = fitBuilding(map, points, {box, bearing: 0, projectAbs, animate: false, maxZoom: 21});
  assert.equal(map._elevateCameraIfInsideTerrain, check, 'MapLibre’s lift is back after the fit');
  assert.equal(target.pitch, CAMERA.eye.pitch, 'the eye pitch, as asked');
  map.jumpTo({...target}); map.land();
  assert.equal(map.getPitch(), CAMERA.eye.pitch, 'not lifted where it lands');
  const b = screenBounds(map, drawn, (_, q) => projectAbs(map, q));
  assert.ok(b.minX >= box.left - 2 && b.maxX <= box.right + 2 && b.minY >= box.top - 2 && b.maxY <= box.bottom + 2, `inside the box: ${JSON.stringify(b)}`);
});

test('fit on terrain (0.3.2): when the camera at the asked corner stays inside the hill, another corner keeps the eye pitch', () => {
  // A ridge rises 150 m south of the block (45°, as drawn): every camera looking north at it from the south stands in it.
  const terrain = (lng, lat) => 40 + Math.max(0, -(lat - LAT) * KY - 150);
  const block = rect(60, 40, 0);
  const points = block.flatMap(([a, b]) => [[a, b, 0, 40], [a, b, 15, 40]]);
  const drawn = block.flatMap(([a, b]) => [[a, b, 40], [a, b, 55]]);
  const box = {left: 12, top: 54, right: 343, bottom: 194};
  const inside = (b, tol) => b && b.minX >= box.left - tol && b.maxX <= box.right + tol && b.minY >= box.top - tol && b.maxY <= box.bottom + tol;
  // Asked alone, the corner is lifted: the target says so (a lower pitch) and still frames the block where it lands.
  const one = fakeMap({width: 390, height: 652, terrain, lift: true});
  const lifted = fitBuilding(one.map, points, {box, bearing: 0, projectAbs: one.projectAbs, animate: false, maxZoom: 21});
  assert.ok(lifted.pitch < CAMERA.eye.pitch - 0.5, `lifted (${lifted.pitch})`);
  one.map.jumpTo({...lifted}); one.map.land();
  const lb = screenBounds(one.map, drawn, (_, q) => one.projectAbs(one.map, q));
  assert.ok(inside(lb, 4), `the lifted frame holds: ${JSON.stringify(lb)}`);
  // With the other corners offered, the opposite one (from the open side) keeps the two-point view.
  const two = fakeMap({width: 390, height: 652, terrain, lift: true});
  const target = fitBuilding(two.map, points, {box, bearing: 0, alternates: [180, 90, -90], projectAbs: two.projectAbs, animate: false, maxZoom: 21});
  assert.equal(target.pitch, CAMERA.eye.pitch);
  assert.equal(Math.abs(target.bearing), 180, 'looking at it from the open side');
  two.map.jumpTo({...target}); two.map.land();
  assert.ok(inside(screenBounds(two.map, drawn, (_, q) => two.projectAbs(two.map, q)), 2));
});

test('two-point bearing avoids a drawn building standing between the camera and the venue', () => {
  const venue = [rect(60, 60, 0)];
  // A 40 m component just south-west of the venue: looking from the south-west (bearing 45) it hides the venue.
  const block = {ring: rect(50, 50, 0, [-55, -55]), height: 40};
  assert.ok(occlusionScore(venue, [block], 45) > 0, 'in front when the camera looks north-east');
  assert.equal(occlusionScore(venue, [block], -135), 0, 'behind when the camera looks south-west');
  assert.equal(twoPointBearing(venue, 45), 45, 'no obstacle: nearest diagonal');
  const b = twoPointBearing(venue, 45, [block]);
  assert.notEqual(b, 45, 'with the obstacle the camera moves to another corner');
  assert.equal(occlusionScore(venue, [block], b), 0);
  // A low building far in front stays under the sight line and does not count.
  assert.equal(occlusionScore(venue, [{ring: rect(30, 30, 0, [-160, -160]), height: 6}], 45), 0);
});
