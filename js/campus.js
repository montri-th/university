/**
 * Campus geometry on the map (data/campus.json, loaded after the first paint — an optional file, js/app.js PARTIAL):
 *
 *  - extents: the approximate campus extents of OpenStreetMap the research team selected (30_DEMO_GEOMETRY role
 *    campus_extent; ODbL, © OpenStreetMap contributors) for the sites in focus — a dashed outline, the open site's
 *    solid in the selection stroke. An extent is a picture of where the campus is, never a legal boundary, a land
 *    holding or the place of its students.
 *  - faculty geometry of the open site (31_DEMO_UNIT_SITES → 30): building footprints and shared buildings (outline;
 *    in 3D the drawn buildings they fall in are lifted in the active-layer colour by js/app.js), mapped areas (dashed)
 *    and reference points (small dots) — evidence of where a faculty is, never its whole territory.
 * Colours are foundation map tokens of assets/theme.css (context marks: not a data scale, not a category).
 */
import {GEOJSON_MAXZOOM} from './map-layers.js';

export const CAMPUS_MIN_ZOOM = 10;
export const CAMPUS_LAYERS = Object.freeze({
  hit: 'campus-extent-hit', extent: 'campus-extent', extentSelected: 'campus-extent-selected', facultyArea: 'campus-faculty-area',
  facultyBuilding: 'campus-faculty-building', facultyPoint: 'campus-faculty-point',
});
const SOURCES = Object.freeze({extent: 'campus-extents', faculty: 'campus-faculty'});
const EMPTY = Object.freeze({type: 'FeatureCollection', features: []});

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}

/**
 * Decode data/campus.json: geometry list (index = position), faculties and offerings by site index, quality by
 * university index. Pure.
 */
export function decodeCampus(json) {
  if (!Array.isArray(json?.geometry)) throw new Error('Invalid campus file');
  const geometry = json.geometry.map((g, i) => ({...g, index: i}));
  const bySite = new Map();
  for (const g of geometry) { let a = bySite.get(g.site); if (!a) bySite.set(g.site, a = []); a.push(g); }
  const faculties = new Map(Object.entries(json.faculties || {}).map(([k, v]) => [Number(k), v]));
  const offerings = new Map(Object.entries(json.offerings || {}).map(([k, v]) => [Number(k), v]));
  const quality = new Map(Object.entries(json.quality || {}).map(([k, v]) => [Number(k), v]));
  return {meta: json.meta || {}, geometry, bySite, faculties, offerings, quality};
}

/** GeoJSON of the extents of `siteIndexes` (index into data sites) that have one. */
export function extentCollection(campus, sites, siteIndexes) {
  const features = [];
  for (const i of siteIndexes) {
    const s = sites[i], g = s && s.extent >= 0 ? campus?.geometry[s.extent] : null;
    if (g) features.push({type: 'Feature', id: g.index, geometry: g.g, properties: {site: i, id: s.id}});
  }
  return {type: 'FeatureCollection', features};
}

/** GeoJSON of the faculty geometry of one site (every role but the extent). */
export function facultyCollection(campus, siteIndex) {
  const list = (campus?.bySite.get(siteIndex) || []).filter(g => g.role !== 'extent');
  return {type: 'FeatureCollection', features: list.map(g => ({type: 'Feature', id: g.index, geometry: g.g, properties: {role: g.role, name: g.name || ''}}))};
}

export function installCampusLayers(map, {beforeId} = {}) {
  map.addSource(SOURCES.extent, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM, promoteId: 'site'});
  map.addSource(SOURCES.faculty, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});
  const paint = () => ({
    extent: {'line-color': cssVar('--border-emphasis', '#7D877F'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.6], 'line-dasharray': [2, 1.5],
      'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0, 1]},
    selected: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 15, 3],
      'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0]},
    area: {'line-color': cssVar('--map-active-layer', '#347DA8'), 'line-width': 1.6, 'line-dasharray': [1.2, 1.2]},
    building: {'line-color': cssVar('--map-active-layer', '#347DA8'), 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 2]},
    point: {'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.6, 18, 5], 'circle-color': cssVar('--map-active-layer', '#347DA8'),
      'circle-stroke-color': cssVar('--map-marker-halo', '#FFFFFF'), 'circle-stroke-width': 1.4},
  });
  const p = paint();
  // A transparent fill: a click inside a campus extent opens its site (never drawn, never a data colour).
  map.addLayer({id: CAMPUS_LAYERS.hit, type: 'fill', source: SOURCES.extent, minzoom: CAMPUS_MIN_ZOOM, paint: {'fill-color': '#000000', 'fill-opacity': 0}}, beforeId);
  map.addLayer({id: CAMPUS_LAYERS.extent, type: 'line', source: SOURCES.extent, minzoom: CAMPUS_MIN_ZOOM, paint: p.extent}, beforeId);
  map.addLayer({id: CAMPUS_LAYERS.extentSelected, type: 'line', source: SOURCES.extent, minzoom: CAMPUS_MIN_ZOOM - 2, paint: p.selected}, beforeId);
  map.addLayer({id: CAMPUS_LAYERS.facultyArea, type: 'line', source: SOURCES.faculty, filter: ['==', ['get', 'role'], 'area'], paint: p.area}, beforeId);
  map.addLayer({id: CAMPUS_LAYERS.facultyBuilding, type: 'line', source: SOURCES.faculty, filter: ['in', ['get', 'role'], ['literal', ['building', 'shared']]], paint: p.building}, beforeId);
  map.addLayer({id: CAMPUS_LAYERS.facultyPoint, type: 'circle', source: SOURCES.faculty, filter: ['==', ['get', 'role'], 'point'], paint: p.point});
  let selected = -1, lastExtents = null;

  function update({extents = EMPTY, faculty = EMPTY, selectedSite = -1} = {}) {
    if (extents !== lastExtents) { map.getSource(SOURCES.extent)?.setData(extents); lastExtents = extents; }
    map.getSource(SOURCES.faculty)?.setData(faculty);
    if (selected >= 0) map.setFeatureState({source: SOURCES.extent, id: selected}, {selected: false});
    selected = selectedSite;
    if (selected >= 0) map.setFeatureState({source: SOURCES.extent, id: selected}, {selected: true});
  }
  function retheme() {
    const q = paint();
    const set = (id, props) => { if (map.getLayer(id)) for (const [k, v] of Object.entries(props)) map.setPaintProperty(id, k, v); };
    set(CAMPUS_LAYERS.extent, q.extent); set(CAMPUS_LAYERS.extentSelected, q.selected); set(CAMPUS_LAYERS.facultyArea, q.area);
    set(CAMPUS_LAYERS.facultyBuilding, q.building); set(CAMPUS_LAYERS.facultyPoint, q.point);
  }
  /** The site (index) whose extent is under a screen point, or -1 (a click inside a campus opens it). */
  function hitTest(point) {
    const layers = [CAMPUS_LAYERS.hit].filter(id => map.getLayer(id));
    if (!layers.length || map.getZoom() < CAMPUS_MIN_ZOOM) return -1;
    const f = map.queryRenderedFeatures([[point.x - 4, point.y - 4], [point.x + 4, point.y + 4]], {layers})[0];
    return f ? Number(f.properties?.site) : -1;
  }
  function dispose() {
    for (const id of Object.values(CAMPUS_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of Object.values(SOURCES)) if (map.getSource(id)) map.removeSource(id);
  }
  return {update, retheme, hitTest, dispose, layerIds: CAMPUS_LAYERS};
}
