/**
 * Province frames — the reading of this dataset. The MHESI student file names a province for each reporting unit, and
 * that is the finest place its students have (DATA_METHOD.md §2): every one of the 77 provinces is a frame filled with
 * the measure (students reported → LI `li.supply`; reporting units → LDS `count` — totals, no denominator).
 *
 * Thailand: every frame filled; the Aha's provinces carry the focus stroke. With a จังหวัด filter that frame is filled
 * under its selection stroke and the others go quiet (outline only — a data colour is never made paler). The fill is a
 * hard switch at PROVINCE_FILL_MAX_ZOOM (never a fade): from there up the campus extents, the site symbols and the
 * buildings carry the reading, and the outline thins out until PROVINCE_OUTLINE_MAX_ZOOM.
 *
 * Boundaries: data/provinces.geojson (copied unchanged from montri-th/pharmacy@98d9035, where it was dissolved from
 * CityMETER production subdistrict boundaries) — navigation frames, never an administrative claim.
 * EVID-05: measured · measured_zero (no unit of the file reports under that province under the filters — a 0 of
 * this file, not a census of universities: a campus may still stand there).
 */
import {provinceByCode, metricOf, provinceTotals} from './model.js';
import {buildMetricRamp, classify} from './scales.js';
import {featureBounds, firstLineLayerId, GEOJSON_MAXZOOM} from './map-layers.js';

export const PROVINCE_FILL_MAX_ZOOM = 10.5;
export const PROVINCE_OUTLINE_MAX_ZOOM = 13;
export const PROVINCE_LABEL_MAX_ZOOM = 10;
const SOURCE = 'provinces';
export const PROVINCE_LAYERS = Object.freeze({fill: 'province-fill', zero: 'province-zero-outline', outline: 'province-outline', focus: 'province-focus', selected: 'province-selected'});

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}

/** Per-province model: the measure per province among `units` (each unit carries the source's province). */
export function buildProvinceModel(units, geojson, {metric = 'students'} = {}) {
  const totals = provinceTotals(units || [], metric);
  const provinces = (geojson?.features || []).map(f => {
    const code = String(f.id ?? f.properties?.id);
    const meta = provinceByCode(code) || {code, th: f.properties?.name || code, en: f.properties?.nameEn || code};
    const t = totals.get(code);
    return {id: code, code, name: meta.th, nameEn: meta.en, value: t?.value || 0, count: t?.count || 0, students: t?.students || 0,
      label: f.properties?.label || null, feature: f};
  });
  const ramp = buildMetricRamp(provinces.map(p => p.value), {metric, unit: metricOf(metric).one});
  for (const p of provinces) { const c = classify(p.value, ramp); p.state = c.state; p.fill = c.fill; p.ink = c.ink; p.outline = c.outline || null; }
  return {metric, provinces, byCode: new Map(provinces.map(p => [p.code, p])), ramp, zeroCount: provinces.filter(p => p.state === 'measured_zero').length};
}

export function installProvinceLayers(map, geojson) {
  const beforeId = firstLineLayerId(map);
  map.addSource(SOURCE, {type: 'geojson', data: geojson, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  const fs = (key, on, off = 0) => ['case', ['boolean', ['feature-state', key], false], on, off];
  map.addLayer({id: PROVINCE_LAYERS.fill, type: 'fill', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'fill-color': ['coalesce', ['feature-state', 'fill'], '#000000'], 'fill-opacity': fs('filled', 1), 'fill-antialias': true}}, beforeId);
  map.addLayer({id: PROVINCE_LAYERS.zero, type: 'line', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'line-color': cssVar('--data-zero-outline', '#7D877F'), 'line-width': 2, 'line-opacity': fs('zero', 1)}}, beforeId);
  map.addLayer({id: PROVINCE_LAYERS.outline, type: 'line', source: SOURCE, maxzoom: PROVINCE_OUTLINE_MAX_ZOOM,
    paint: {'line-color': ['case', ['boolean', ['feature-state', 'quiet'], false], cssVar('--border-default', '#C9D0CB'), cssVar('--border-emphasis', '#7D877F')],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 9, 1.2, 12, 1.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 1, 13, 0.35]}});
  map.addLayer({id: PROVINCE_LAYERS.focus, type: 'line', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'line-color': cssVar('--map-focus-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 9, 2.6], 'line-opacity': fs('focus', 1)}});
  map.addLayer({id: PROVINCE_LAYERS.selected, type: 'line', source: SOURCE, maxzoom: 14,
    paint: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.8, 9, 2.8, 13, 2.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, fs('selected', 1), 14, fs('selected', 0.3)]}});
  let current = {provinces: [], ramp: null, zeroCount: 0};
  const ids = (geojson?.features || []).map(f => String(f.id ?? f.properties?.id));

  /** units: the filtered units WITHOUT the province filter (every frame keeps its own total); selectedCode: the จังหวัด filter; focus: the Aha's codes. */
  function update({units = [], selectedCode = '', focus = [], visible = true, metric = 'students'} = {}) {
    current = buildProvinceModel(units, geojson, {metric});
    const focused = new Set(selectedCode ? [] : focus);
    for (const id of ids) {
      const p = current.byCode.get(id);
      p.selected = id === selectedCode; p.quiet = Boolean(selectedCode) && !p.selected; p.focus = focused.has(id);
      const filled = !p.quiet;
      map.setFeatureState({source: SOURCE, id}, {fill: p.fill, filled, zero: filled && p.state === 'measured_zero', quiet: p.quiet, selected: p.selected, focus: p.focus});
    }
    for (const id of Object.values(PROVINCE_LAYERS)) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    return current;
  }
  function retheme() {
    if (map.getLayer(PROVINCE_LAYERS.zero)) map.setPaintProperty(PROVINCE_LAYERS.zero, 'line-color', cssVar('--data-zero-outline', '#7D877F'));
    if (map.getLayer(PROVINCE_LAYERS.focus)) map.setPaintProperty(PROVINCE_LAYERS.focus, 'line-color', cssVar('--map-focus-stroke', '#176B82'));
    if (map.getLayer(PROVINCE_LAYERS.selected)) map.setPaintProperty(PROVINCE_LAYERS.selected, 'line-color', cssVar('--map-selected-stroke', '#176B82'));
  }
  function dispose() {
    for (const id of Object.values(PROVINCE_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  }
  return {update, retheme, dispose, model: () => current, layerIds: PROVINCE_LAYERS};
}

/** Bounds of one province frame (drill-down fit). */
export function provinceBounds(geojson, code, LngLatBounds) {
  const f = (geojson?.features || []).find(x => String(x.id ?? x.properties?.id) === code);
  return f ? featureBounds(f, LngLatBounds) : null;
}

/** Province code under a point (lng/lat) from the province frames (country view geometry), or ''. */
export function provinceLocator(provincesGeo) {
  const inRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const items = (provincesGeo?.features || []).map(f => {
    const g = f.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    const [w, s, e, n] = f.properties?.bbox || [-180, -90, 180, 90];
    return {id: String(f.id ?? f.properties?.id), polys, w, s, e, n};
  });
  return ([x, y]) => {
    for (const it of items) {
      if (x < it.w || x > it.e || y < it.s || y > it.n) continue;
      if (it.polys.some(p => inRing([x, y], p[0]) && !p.slice(1).some(h => inRing([x, y], h)))) return it.id;
    }
    return '';
  };
}
