import test from 'node:test';
import assert from 'node:assert/strict';
import {tileToLonLat, parseVectorTile} from '../js/shell/mvt.js';
import {shapeTile, shapeCmTile, planCmRequests, installMassing, cmFeatureId, focusFeatureId, cmHeight, tileBox, CM_ID_BASE, CM_SLOTS, DEFAULT_CM_HEIGHT_M, HEIGHT_LIFT_M,
  MAX_CM_REQUESTS, CITY_LAYER, CONTEXT_LAYER, CONTEXT_SOURCE, CM_CREDIT_LAYER, FOCUS_SOURCE, roundingRadiusM, encloseOffsetM} from '../js/massing.js';
import {cmTileUrl, zoneAt, zonesFor, zonesOf, validUnitFile, createBuildingUnitStore, CM_TILE_API, CM_ATTRIBUTION} from '../js/shell/building-units.js';
import {joinBuildings} from '../js/shell/building-join.js';
import {renderBuilding, BUILDING_SOURCE_TH} from '../js/panel.js';
import {encodeTile, square} from './mvt-encode.js';

/* ---------- a synthetic Bangkok tile: OSM (OpenFreeMap schema) and one CityMETER unit over its left half ---------- */
const T = {z: 14, x: 12767, y: 7560};
const ll = ring => ring.map(([px, py]) => tileToLonLat(px, py, T));
const bboxOf = ring => [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))];
const zoneRing = ll([[0, 0], [2048, 0], [2048, 4096], [0, 4096], [0, 0]]);
const ZONE = Object.freeze({id: 'unit-a', code: '04100101', name: 'เทศบาลทดสอบ', province: 'BKK', bbox: bboxOf(zoneRing), polygons: [[zoneRing]], tileType: 'MUNICIPALITY', tileUnits: [{id: 'unit-a', bbox: bboxOf(zoneRing)}]});
const focus = ll([[0, 0], [3072, 0], [3072, 4096], [0, 4096], [0, 0]]); // left three quarters
const osmTile = {extent: 4096, layers: [{name: 'building', features: [
  // 201: one OpenFreeMap feature, two buildings: A in the unit (replaced), B outside the focus (comes back as context)
  {id: 201, properties: {render_height: 6, render_min_height: 0}, rings: [square(500, 500, 100), square(3500, 500, 100)]},
  // 202: an outline OSM maps in parts (hide_3d) inside the unit; 203: its part (stays, LOD2)
  {id: 202, properties: {render_height: 40, render_min_height: 0, hide_3d: true}, rings: [square(1000, 1000, 400)]},
  {id: 203, properties: {render_height: 40, render_min_height: 10}, rings: [square(1100, 1100, 100)]},
  // 204: in the focus, outside the unit (OSM stays)
  {id: 204, properties: {render_height: 9, render_min_height: 0}, rings: [square(2500, 2500, 100)]},
]}]};
const cmTile = {layers: [{name: 'building-detail', features: [
  {properties: {height_m: '12.50', estimated_floor: 4, height_class_code: 'H2'}, rings: [square(520, 520, 90)]},   // c1: drawn
  {properties: {height_m: '30.00', estimated_floor: 9, height_class_code: 'H4'}, rings: [square(1150, 1150, 120)]}, // c2: in the parts outline → left out
  {properties: {height_m: '8.00', estimated_floor: 2, height_class_code: 'H1'}, rings: [square(-300, 700, 200)]},   // c3: interior in the western tile → drawn there
  {properties: {estimated_floor: 1}, rings: [square(1700, 3000, 60)]},                                             // c4: no height_m → default height
]}]};
const osmBytes = encodeTile(osmTile.layers), cmBytes = encodeTile(cmTile.layers);
const osmLayer = parseVectorTile(osmBytes).layers.building, cmLayer = parseVectorTile(cmBytes).layers['building-detail'];
const r = roundingRadiusM(16), d = encloseOffsetM(r);

test('a CityMETER unit replaces the OSM buildings of the focus whose interior falls in it; parts (LOD2) stay; the city tier hides the feature and its other buildings come back as context', () => {
  const out = shapeTile(T, osmLayer, {regions: [focus], radiusM: r, offsetM: d, zones: [ZONE]});
  const drawn = out.features.map(f => f.properties.osm_id).sort();
  assert.deepEqual(drawn, [203, 204], 'A (201, in the unit) is replaced; the part (203) and the building outside the unit (204) stay');
  assert.equal(out.replaced, 1);
  assert.deepEqual([...out.hiddenIds], [201], 'the city tier hides the replaced feature by its tile id');
  assert.equal(out.context.length, 1, 'B — the same feature, outside the focus — is drawn as context');
  assert.deepEqual(out.context[0].properties, {height: 6, base: 0});
  assert.equal(out.partOutlines.length, 1, 'the outline of the building mapped in parts is handed to the CityMETER tier');
  assert.ok(out.footprints.some(b => b.outline && b.osmId === 202), 'the outline stays a join footprint (building-join groups its parts)');
  // Without a zone the tile is drawn exactly as before (0.2.0): A drawn, nothing hidden, no context.
  const before = shapeTile(T, osmLayer, {regions: [focus], radiusM: r, offsetM: d});
  assert.deepEqual(before.features.map(f => f.properties.osm_id).sort(), [201, 203, 204]);
  assert.equal(before.hiddenIds.size, 0); assert.equal(before.context.length, 0); assert.equal(before.replaced, 0);
  // Stable ids: the zone changes which buildings are drawn, never their ids.
  const id = o => o.features.find(f => f.properties.osm_id === 204).id;
  assert.equal(id(out), id(before));
});

test('CityMETER buildings: drawn once (home tile, shared geometry), only in the focus, never inside an OSM parts outline; height_m is the height', () => {
  const parts = shapeTile(T, osmLayer, {regions: [focus], radiusM: r, offsetM: d, zones: [ZONE]}).partOutlines;
  const seen = new Set();
  const out = shapeCmTile(T, cmLayer, {regions: [focus], radiusM: r, offsetM: d, slot: 0, skipRings: parts, seen});
  assert.equal(out.kept, 2, 'c1 and c4');
  assert.equal(out.inParts, 1, 'c2 stands in the parts outline: the OSM parts are drawn instead');
  assert.equal(out.away, 1, 'c3 belongs to the western tile, which draws it whole');
  assert.deepEqual(out.features.map(f => f.properties.render_height).sort((a, b) => a - b), [DEFAULT_CM_HEIGHT_M, 12.5]);
  assert.equal(out.features.find(f => f.properties.render_height === 12.5).properties.height, 12.5 + HEIGHT_LIFT_M);
  assert.ok(out.features.every(f => f.properties.source === 'cm' && f.properties.base === 0));
  assert.ok(out.footprints.every(b => b.source === 'cm' && b.osmId === null && !b.outline));
  // Ids: CityMETER from 2^52 up (apart from every OSM id), exact, unique.
  for (const f of out.features) { assert.ok(Number.isSafeInteger(f.id) && f.id >= CM_ID_BASE); }
  assert.equal(new Set(out.features.map(f => f.id)).size, out.features.length);
  assert.ok(focusFeatureId({x: 16383, y: 16383}, 2 ** 24 - 1) < CM_ID_BASE, 'every z14 OSM id is below 2^52');
  assert.ok(cmFeatureId({x: 16383, y: 16383, z: 14}, CM_SLOTS - 1, 2 ** 19 - 1) < 2 ** 53);
  // A second request carrying the same building (a shared geometry) draws nothing new.
  const twice = shapeCmTile(T, cmLayer, {regions: [focus], radiusM: r, offsetM: d, slot: 1, skipRings: parts, seen});
  assert.equal(twice.kept, 0); assert.equal(twice.shared, 3, "c1, c2 and c4 were seen (c2 is left out again either way)");
  // The model encloses the footprint as the OSM focus tier does (rounded, offset outward).
  const c1 = out.features.find(f => f.properties.render_height === 12.5);
  assert.ok(c1.geometry.coordinates[0].length > 5, 'corners are rounded');
  // The western tile draws c3 whole (its interior is there).
  const west = {...T, x: T.x - 1};
  const westFocus = ll([[-4096, 0], [3072, 0], [3072, 4096], [-4096, 4096], [-4096, 0]]);
  const w = shapeCmTile(west, parseVectorTile(encodeTile([{name: 'building-detail', features: [{properties: {height_m: '8.00'}, rings: [square(4096 - 300, 700, 200)]}]}])).layers['building-detail'], {regions: [westFocus], radiusM: r, offsetM: d});
  assert.equal(w.kept, 1);
  assert.equal(cmHeight({height_m: 'x'}), DEFAULT_CM_HEIGHT_M); assert.equal(cmHeight({height_m: '0'}), DEFAULT_CM_HEIGHT_M); assert.equal(cmHeight({height_m: '136.71'}), 136.71);
});

test('CityMETER requests: one per tile and tile unit meeting it, nearest the camera first, bounded; a zone is drawn in a tile only with all its requests', () => {
  const east = {...T, x: T.x + 1}, far = {...T, x: T.x + 5};
  const p = planCmRequests([far, east, T], [ZONE], {center: tileToLonLat(10, 10, T)});
  assert.deepEqual(p.requests.map(q => `${q.tile.x}|${q.tileUnit.id}|${q.slot}`), [`${T.x}|unit-a|0`], 'the unit box meets only its own tile');
  assert.deepEqual([...p.zonesByTile.keys()], [`14/${T.x}/${T.y}`]);
  // A Bangkok เขต is read per แขวง: every แขวง whose box meets the tile, in id order → slots.
  const [w, s, e, n] = tileBox(T);
  const khet = {...ZONE, id: 'khet', tileType: 'SUBDISTRICT', tileUnits: [{id: 'khwaeng-b', bbox: [w, s, (w + e) / 2, n]}, {id: 'khwaeng-a', bbox: [(w + e) / 2, s, e, n]}, {id: 'khwaeng-c', bbox: [e + 1, s, e + 2, n]}]};
  const k = planCmRequests([T], [khet]);
  assert.deepEqual(k.requests.map(q => [q.tileUnit.id, q.slot, q.tileType]), [['khwaeng-b', 1, 'SUBDISTRICT'], ['khwaeng-a', 0, 'SUBDISTRICT']]);
  // Over the bound a zone is not planned in that tile at all (OSM stays there), never half of its แขวง.
  const capped = planCmRequests([T], [khet], {max: 1});
  assert.equal(capped.requests.length, 0); assert.equal(capped.truncated, true); assert.equal(capped.zonesByTile.size, 0);
  assert.equal(planCmRequests([T], []).requests.length, 0);
  assert.ok(MAX_CM_REQUESTS >= 16);
  // With national slots (data/building-units) a tile unit keeps its slot whatever else the focus holds: the same
  // building keeps its id from the district view to the square round a stay.
  const slotted = {...khet, tileUnits: khet.tileUnits.map((tu, i) => ({...tu, slot: 4000 + i}))};
  const alone = {...slotted, tileUnits: [slotted.tileUnits[1]]};
  assert.deepEqual(planCmRequests([T], [slotted]).requests.map(q => q.slot), [4000, 4001]);
  assert.deepEqual(planCmRequests([T], [alone]).requests.map(q => q.slot), [4001]);
  assert.equal(cmFeatureId(T, 4001, 7), cmFeatureId(T, 4001, 7));
  assert.notEqual(cmFeatureId(T, 4001, 7), cmFeatureId(T, 4000, 7));
});

test('the production tile URL names the tile, the tile unit and V4; zones are found by box, then by outline (holes out)', () => {
  assert.equal(cmTileUrl(T, {id: 'b64c/eeb9'}, 'MUNICIPALITY'), `${CM_TILE_API}14/${T.x}/${T.y}?inTileType=MUNICIPALITY&inTileId=b64c%2Feeb9&version=V4`);
  assert.equal(cmTileUrl(T, {id: 'x'}, 'PROVINCE'), '', 'only อปท. and แขวง tiles');
  assert.ok(CM_TILE_API.startsWith('https://landometer.com/'));
  assert.match(CM_ATTRIBUTION, /CityMETER Building V4/);
  const inside = tileToLonLat(1000, 2000, T), outside = tileToLonLat(3000, 2000, T);
  assert.equal(zoneAt([ZONE], inside)?.id, 'unit-a');
  assert.equal(zoneAt([ZONE], outside), null);
  const hole = ll([[800, 1800], [800, 2200], [1200, 2200], [1200, 1800], [800, 1800]]);
  const holed = {...ZONE, polygons: [[zoneRing, hole]]};
  assert.equal(zoneAt([holed], inside), null, 'a hole of the unit is outside it');
  assert.deepEqual(zonesFor([ZONE], [focus]).map(z => z.id), ['unit-a']);
  assert.deepEqual(zonesFor([ZONE], [ll(square(5000, 5000, 10))]), []);
});

test('unit files: only a CityMETER unit needs an outline and tile units; the store reads the index first and never requests a province without CityMETER units', async () => {
  const cmUnit = {id: 'u1', code: '1', name: 'ก', source: 'cm', bbox: ZONE.bbox, tileType: 'MUNICIPALITY', tileUnits: ZONE.tileUnits, outline: [[zoneRing]]};
  const osmUnit = {id: 'u2', code: '2', name: 'ข', source: 'osm', bbox: ZONE.bbox};
  assert.equal(validUnitFile({province: 'PKT', units: [cmUnit, osmUnit]}), true);
  assert.equal(validUnitFile({province: 'PKT', units: [{...cmUnit, outline: []}]}), false, 'a CityMETER unit without its outline is refused (the area stays OSM)');
  assert.equal(validUnitFile({province: 'PKT', units: [{...cmUnit, source: 'none'}]}), false);
  assert.deepEqual(zonesOf({province: 'PKT', units: [cmUnit, osmUnit]}).map(z => z.id), ['u1']);
  const asked = [];
  const files = {'index.json': {meta: {}, provinces: [{province: 'PKT', cm: 1}, {province: 'NAN', cm: 0}]}, 'PKT.json': {province: 'PKT', units: [cmUnit, osmUnit]}};
  const fetchJSON = async url => { const name = url.split('/').pop().split('?')[0]; asked.push(name); if (!files[name]) throw new Error('404'); return files[name]; };
  let loads = 0;
  const store = createBuildingUnitStore({base: 'u/', fetchJSON, version: 'r6', onLoad: () => loads++});
  assert.equal(store.settled('PKT'), false);
  await store.ensureMany(['PKT', 'NAN', 'PKT']);
  assert.deepEqual(asked, ['index.json', 'PKT.json'], 'NAN has no CityMETER unit: never requested');
  assert.equal(loads, 1);
  assert.ok(store.settled('PKT') && store.settled('NAN') && store.settled(''));
  assert.deepEqual(store.zonesFor([focus]).map(z => z.id), ['u1']);
  // A failed file or index leaves the province (or the country) on OSM, settled.
  const broken = createBuildingUnitStore({fetchJSON: async () => { throw new Error('offline'); }, onError: () => {}});
  await broken.ensure('PKT');
  assert.equal(broken.settled('PKT'), true); assert.deepEqual(broken.zones(), []);
});

/** Minimal MapLibre stand-in (as tests/massing.test.js). */
function fakeMap() {
  const layers = new Map(), sources = new Map([['openmaptiles', {}]]), handlers = {};
  return {
    layers, sources, filters: {}, visibility: {}, data: {}, zoomRange: {}, sourceDefs: {},
    setLayerZoomRange(id, min, max) { this.zoomRange[id] = [min, max]; },
    getLayer: id => layers.get(id), getSource: id => sources.get(id),
    addLayer(def) { layers.set(def.id, def); if (def.layout?.visibility) this.visibility[def.id] = def.layout.visibility; },
    addSource(id, def) { this.sourceDefs[id] = def; sources.set(id, {setData: dd => { this.data[id] = dd; }}); },
    removeLayer(id) { layers.delete(id); }, removeSource(id) { sources.delete(id); },
    setFilter(id, f) { this.filters[id] = f; }, setLayoutProperty(id, k, v) { this.visibility[id] = v; },
    paint: {}, setPaintProperty(id, k, v) { (this.paint[id] ||= {})[k] = v; },
    getZoom: () => 16, getPitch: () => 60, on(e, h) { handlers[e] = h; }, off(e) { delete handlers[e]; },
    project: ([lon, lat]) => ({x: lon * 1e5, y: -lat * 1e5}),
    querySourceFeatures: () => [], setFeatureState() {}, removeFeatureState() {},
  };
}

test('installMassing draws a CityMETER unit from its tiles, hides the replaced city-tier features (one hashed match), credits the source while drawn, and falls back to OSM when a tile fails', async () => {
  const map = fakeMap();
  let cmOk = true;
  const fetched = [];
  const massing = installMassing(map, {
    beforeId: null, colors: {}, tileUrl: t => `osm/${t.z}/${t.x}/${t.y}`, cmTileUrl, cmAttribution: CM_ATTRIBUTION,
    fetchImpl: async url => {
      fetched.push(url);
      const body = url.startsWith(CM_TILE_API) ? (url.includes(`/${T.x}/${T.y}?`) ? cmBytes : new ArrayBuffer(0)) : url === `osm/14/${T.x}/${T.y}` ? osmBytes : encodeTile([{name: 'building', features: []}]);
      return url.startsWith(CM_TILE_API) && !cmOk ? {ok: false, status: 503} : {ok: true, arrayBuffer: async () => body};
    },
  });
  assert.equal(map.sourceDefs['cm-buildings-credit'].attribution, CM_ATTRIBUTION);
  assert.equal(map.visibility[CM_CREDIT_LAYER], 'none', 'no CityMETER building yet: not credited');
  const res = await massing.update({regions: [focus], zones: [ZONE], zoom: 16, enabled: true, city: true, latitude: 13.75, center: tileToLonLat(100, 100, T)});
  assert.equal(res.cm.requests, 2, 'its own tile and the western one (the focus and the unit box both touch the west edge)');
  assert.ok(fetched.some(u => u === cmTileUrl(T, ZONE.tileUnits[0], 'MUNICIPALITY')));
  assert.equal(res.cm.kept, 2); assert.equal(res.replaced, 1); assert.equal(res.context, 1);
  assert.deepEqual(map.filters[CITY_LAYER], ['all', ['!=', ['get', 'hide_3d'], true], ['match', ['id'], [201], false, true]]);
  assert.equal(map.data[CONTEXT_SOURCE].features.length, 1);
  assert.ok(Number.isFinite(map.data[CONTEXT_SOURCE].features[0].properties.fade), 'context carries its distance fade');
  assert.equal(map.visibility[CM_CREDIT_LAYER], 'visible', 'CityMETER Building V4 is credited while drawn');
  assert.equal(map.visibility[CONTEXT_LAYER], 'visible');
  const sources = map.data[FOCUS_SOURCE].features.map(f => f.properties.source || 'osm').sort();
  assert.deepEqual(sources, ['cm', 'cm', 'osm', 'osm']);
  // The join keys a CityMETER building `cm:` (the panel names its source and calls its height an estimate).
  const fps = massing.buildings();
  const c1 = fps.find(b => b.source === 'cm' && b.height === 12.5);
  const [lon, lat] = tileToLonLat(565, 565, T);
  const j = joinBuildings(fps, [{id: 'h1', longitude: lon, latitude: lat}]);
  const key = j.byRow.get('h1');
  assert.ok(key.startsWith('cm:')); assert.equal(j.buildings.get(key).kind, 'cm'); assert.deepEqual(j.buildings.get(key).refs, [c1.id]);
  const html = renderBuilding({kind: 'cm', height: 12.5, geoms: [], faculties: [], site: {id: 's1', name: 'วิทยาเขตทดสอบ'}}, {unit: {id: 'students', one: 'คน'}, meta: {checkedOn: '2026-11-01'}});
  assert.match(html, /สูงราว 13 ม\./); assert.match(html, /title="ความสูงจาก CityMETER Building V4"/); assert.match(html, /ขอบอาคาร CityMETER Building V4/);
  assert.equal(BUILDING_SOURCE_TH.osm, 'OpenStreetMap');
  // A failing CityMETER tile: the unit stays on OSM in that tile (never an empty block), nothing hidden, no credit.
  // (A new tile unit: tiles already loaded are served from the cache.)
  cmOk = false;
  const unitB = {...ZONE, id: 'unit-b', tileUnits: [{id: 'unit-b', bbox: ZONE.bbox}]};
  const fallback = await massing.update({regions: [ll(square(10, 10, 3000))], zones: [unitB], zoom: 16, enabled: true, city: true, latitude: 13.75, center: tileToLonLat(100, 100, T)});
  assert.equal(fallback.cm.failed, fallback.cm.requests); assert.equal(fallback.cm.kept, 0); assert.equal(fallback.replaced, 0);
  assert.deepEqual(map.filters[CITY_LAYER], ['all', ['!=', ['get', 'hide_3d'], true]]);
  assert.equal(map.data[CONTEXT_SOURCE].features.length, 0);
  assert.equal(map.visibility[CM_CREDIT_LAYER], 'none');
  assert.ok(map.data[FOCUS_SOURCE].features.some(f => f.properties.osm_id === 201), 'A is drawn from OSM again');
  massing.dispose();
  assert.equal(map.getLayer(CONTEXT_LAYER), undefined); assert.equal(map.getSource('cm-buildings-credit'), undefined);
});

/* ---------- the shipped data (scripts/build-building-units.py) ---------- */
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './helpers.js';

const unitFiles = () => readdirSync(join(ROOT, 'data/building-units')).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
const readUnits = f => JSON.parse(readFileSync(join(ROOT, 'data/building-units', f), 'utf8'));
/** The owner's rule (2026-11-01), recomputed from the counts each unit records. */
const ruleSource = u => {
  if (u.osmMethod === 'bbox_upper_bound' && u.cm && u.osmUpper != null && u.osmUpper * 1.15 <= u.cm) return 'cm';
  if (u.osm == null) return 'osm';
  return u.cm && u.cm >= 1.15 * u.osm ? 'cm' : 'osm';
};

test('building units: every unit follows the 15 % rule from its own recorded counts; only CityMETER units carry outlines and tile units; Bangkok by เขต', () => {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/building-units/index.json'), 'utf8'));
  assert.match(index.meta.rule, /1\.15/);
  assert.match(index.meta.partsOverride, /building:part/);
  assert.ok(index.meta.osm.osmBase.length >= 1);
  const totals = {cm: 0, osm: 0, gap: 0};
  const files = unitFiles();
  assert.equal(files.length, index.provinces.length, 'one file per province with units');
  for (const f of files) {
    const doc = readUnits(f), code = f.replace('.json', '');
    assert.equal(doc.province, code);
    assert.ok(validUnitFile(doc), `${f} is a valid unit file`);
    const row = index.provinces.find(p => p.province === code);
    assert.equal(row.units, doc.units.length);
    for (const u of doc.units) {
      assert.equal(u.source, ruleSource(u), `${code} ${u.code}: source follows the rule (${u.basis})`);
      assert.ok(['bbox_upper_bound', 'bbox_zero', 'polygon', 'poly_error', 'error'].includes(u.osmMethod), u.osmMethod);
      assert.equal(u.gap, (u.cm || 0) < 10 && (u.osm ?? u.osmUpper) != null && (u.osm ?? u.osmUpper) < 10, `${u.code} gap flag`);
      if (u.source === 'cm') {
        assert.ok(u.outline.length > 0 && u.tileUnits.length > 0);
        const [w, s, e, n] = u.bbox, slack = 0.01;
        for (const poly of u.outline) for (const [x, y] of poly[0]) assert.ok(x >= w - slack && x <= e + slack && y >= s - slack && y <= n + slack, `${u.code} outline inside its box`);
        if (code === 'BKK') { assert.equal(u.kind, 'district'); assert.equal(u.tileType, 'SUBDISTRICT'); assert.equal(u.area, u.code); }
        else { assert.equal(u.tileType, 'MUNICIPALITY'); assert.deepEqual(u.tileUnits.map(t => t.id), [u.id]); }
      } else {
        assert.equal(u.outline, undefined, 'an OSM unit needs no outline');
      }
      totals[u.source]++; if (u.gap) totals.gap++;
    }
    assert.equal(row.cm, doc.units.filter(u => u.source === 'cm').length);
  }
  assert.deepEqual(totals, index.meta.totals);
  // National slots: one per CityMETER tile unit, unique across the country (stable building ids).
  const slots = new Map();
  for (const f of files) for (const u of readUnits(f).units) for (const t of u.tileUnits || []) {
    assert.ok(Number.isInteger(t.slot) && t.slot >= 0 && t.slot < CM_SLOTS, `${t.id} slot`);
    assert.ok(!slots.has(t.slot) || slots.get(t.slot) === t.id, `slot ${t.slot} unique`);
    slots.set(t.slot, t.id);
  }
  const bkk = readUnits('BKK.json');
  assert.ok(bkk.units.every(u => /^10\d\d$/.test(u.code)), 'Bangkok units are เขต codes');
  // Publication hygiene: no links (production API, private documents) and no source-record fields in the files.
  for (const f of ['index.json', ...files]) {
    const text = readFileSync(join(ROOT, 'data/building-units', f), 'utf8');
    assert.ok(!/drive\.google|docs\.google|spreadsheets/.test(text), `${f}: no private links`);
    if (f !== 'index.json') assert.ok(!/https?:\/\//.test(text), `${f}: no URLs`);
  }
});
