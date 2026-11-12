/**
 * Where the map draws buildings in detail (js/regions.js; owner 2026-11-12 07:31): a campus with its surroundings, and
 * the camera's square when the reader looks elsewhere. scripts/build-campus-units.py evaluates the CityMETER building
 * units round the campuses with the same two figures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SITE_CONTEXT_MIN_M, SITE_CONTEXT_PAD_M, CAMERA_CELL_M, CAMERA_REACH_M, squareAround, ringsBox, siteContextRegions, cameraSquare} from '../js/regions.js';

const metres = ([w, s, e, n], lat) => [(e - w) * 111320 * Math.cos((lat * Math.PI) / 180), (n - s) * 110574];

test('a campus is drawn with its surroundings: the extent and a square reaching past it', () => {
  const lat = 13.7384, lon = 100.5321;
  // A 1.2 km × 0.6 km extent: the square reaches SITE_CONTEXT_PAD_M past the longer half.
  const ext = squareAround(lon, lat, 600).map(([x, y]) => [x, lat + (y - lat) / 2]);
  const regions = siteContextRegions([ext], [lon, lat]);
  assert.equal(regions.length, 2);
  assert.deepEqual(regions[0], ext, 'the extent itself stays a region');
  const [wide, high] = metres(ringsBox([regions[1]]), lat);
  assert.ok(Math.abs(wide / 2 - (600 + SITE_CONTEXT_PAD_M)) < 1 && Math.abs(high / 2 - (600 + SITE_CONTEXT_PAD_M)) < 1, `${wide} × ${high}`);
  // A small extent or a campus with only a point: at least SITE_CONTEXT_MIN_M from its centre.
  const [w2] = metres(ringsBox(siteContextRegions([], [lon, lat])), lat);
  assert.ok(Math.abs(w2 / 2 - SITE_CONTEXT_MIN_M) < 1);
  assert.deepEqual(siteContextRegions([], null), [], 'neither extent nor point: nothing');
});

test('the camera square: from the focus zoom in, snapped to its cell, never while the camera looks at the subject', () => {
  const lat = 16.4721, lon = 102.8236;
  assert.equal(cameraSquare([lon, lat], 11.9), null, 'below the zoom nothing is read');
  const a = cameraSquare([lon, lat], 12.5), b = cameraSquare([lon + 0.001, lat + 0.001], 15);
  assert.ok(a && b);
  assert.equal(a.key, b.key, 'a small pan (about 150 m) keeps the same cell');
  const far = cameraSquare([lon + 0.05, lat], 14);
  assert.notEqual(far.key, a.key, 'a move of about 5 km reads a new square');
  const [wide] = metres(ringsBox([a.ring]), lat);
  assert.ok(Math.abs(wide / 2 - CAMERA_REACH_M) < 5);
  const campus = siteContextRegions([], [lon, lat]);
  assert.equal(cameraSquare([lon, lat], 15, {base: campus}), null, 'inside the subject’s own focus: no extra square');
  assert.ok(cameraSquare([lon + 0.05, lat], 15, {base: campus}), 'away from it: the camera’s square');
  assert.ok(CAMERA_CELL_M < CAMERA_REACH_M, 'the square always covers the camera');
});

test('the CityMETER unit build round the campuses uses the page’s own surroundings', () => {
  const py = readFileSync(new URL('../scripts/build-campus-units.py', import.meta.url), 'utf8');
  const m = /SITE_CONTEXT_MIN_M, SITE_CONTEXT_PAD_M = (\d+), (\d+)/.exec(py);
  assert.ok(m, 'the build states both figures');
  assert.deepEqual([Number(m[1]), Number(m[2])], [SITE_CONTEXT_MIN_M, SITE_CONTEXT_PAD_M]);
});
