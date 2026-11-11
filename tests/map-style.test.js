import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMapStyle, basemapPalette, SOURCE_ID, DATA_FILL_BEFORE, MASSING_BEFORE, FIRST_LINE_LAYER, FIRST_LABEL_LAYER} from '../js/shell/map-style.js';
import {presetFor, CAMERA, DEFAULT_FOV} from '../js/shell/camera.js';

test('generated basemap is a well-formed MapLibre style with the anchor layers the app inserts before', () => {
  for (const theme of ['light', 'dark']) {
    const style = buildMapStyle(theme);
    assert.equal(style.version, 8);
    assert.ok(style.sources[SOURCE_ID]?.url, 'OpenFreeMap TileJSON source');
    assert.ok(style.glyphs.includes('{fontstack}'));
    const ids = style.layers.map(l => l.id);
    assert.equal(new Set(ids).size, ids.length, 'layer ids are unique');
    for (const l of style.layers) if (l.type !== 'background') { assert.equal(l.source, SOURCE_ID); assert.ok(l['source-layer'], `${l.id} names a source-layer`); }
    assert.ok(ids.includes(DATA_FILL_BEFORE) && ids.includes(MASSING_BEFORE));
    const firstLine = style.layers.find(l => l.type === 'line');
    assert.equal(firstLine.id, FIRST_LINE_LAYER, 'data fills sit beneath every line layer');
    const firstSymbol = style.layers.find(l => l.type === 'symbol');
    assert.equal(firstSymbol.id, FIRST_LABEL_LAYER, 'massing sits beneath every label');
    assert.ok(ids.indexOf('building') > ids.indexOf(FIRST_LINE_LAYER), '2D footprints draw above the data fill');
    assert.ok(style.sky && style.light, 'sky/fog quiets the distance; light shades the massing');
    assert.ok(!ids.some(id => /poi|housenumber|boundary/.test(id)), 'no POI, house numbers or admin boundaries');
  }
  const light = basemapPalette('light'), dark = basemapPalette('dark');
  assert.notEqual(light.ground, dark.ground);
  assert.equal(light.ground, '#EEF1EE', 'ground = LDS surface.alt (light)');
  assert.equal(dark.ground, '#11191D', 'ground = LDS surface.canvas (dark)');
});

test('camera presets: 2D plan, 3D city overview, upright-vertical model close-up and two-point option', () => {
  assert.equal(presetFor({view3d: false, mode: 'detail'}), 'plan');
  assert.equal(presetFor({view3d: true, mode: 'overview'}), 'city');
  assert.equal(presetFor({view3d: true, mode: 'detail'}), 'model');
  assert.equal(presetFor({view3d: true, mode: 'detail', twoPoint: true}), 'eye');
  assert.equal(CAMERA.plan.pitch, 0);
  assert.ok(CAMERA.model.fov < DEFAULT_FOV / 2, 'narrow field of view ≈ axonometric');
  assert.ok(CAMERA.eye.pitch <= 90 - CAMERA.eye.fov / 2 - 2, 'two-point: the horizon stays outside the frame (MapLibre 5.6.2 draws fill-extrusion wrongly once it enters)');
  assert.ok(CAMERA.eye.pitch >= 72 && CAMERA.eye.fov <= 26, 'strongly pitched, narrow field of view → verticals near-parallel');
});

test('water reads as water in light and stays quiet; the shore draws above the district fill (0.3.4)', async () => {
  const {readFileSync} = await import('node:fs');
  const {contrastRatio} = await import('../js/scales.js');
  const light = basemapPalette('light'), dark = basemapPalette('dark');
  const css = readFileSync(new URL('../assets/theme.css', import.meta.url), 'utf8');
  const [lightCss, darkCss] = css.split(':root[data-theme="dark"]');
  const token = (block, name) => (block.match(new RegExp(`--basemap-${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
  for (const [name, key] of [['water', 'water'], ['water-line', 'waterLine'], ['shore', 'shore'], ['ground', 'ground']]) {
    assert.equal(token(lightCss, name), light[key], `light --basemap-${name} = the module fallback`);
    assert.equal(token(darkCss, name), dark[key], `dark --basemap-${name} = the module fallback`);
  }
  const water = contrastRatio(light.water, light.ground);
  assert.ok(water >= 1.18 && water <= 1.3, `light water stands apart from the ground but stays quiet (${water.toFixed(2)}:1)`);
  assert.ok(contrastRatio(light.shore, light.water) >= 1.2, 'the shore is darker than the water');
  assert.equal(dark.water, '#18333E', 'dark water = LDS surface.blueTint (dark), unchanged');
  for (const theme of ['light', 'dark']) {
    const ids = buildMapStyle(theme).layers.map(l => l.id);
    assert.ok(ids.indexOf('water-shore') > ids.indexOf(DATA_FILL_BEFORE), 'the shore is drawn above the district fill');
    assert.ok(ids.indexOf('water-shore') < ids.indexOf('building'), 'and beneath footprints and roads');
  }
});
