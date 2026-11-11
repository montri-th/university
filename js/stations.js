/**
 * Rail stations of CityMETER · Transit (montri-th/transit, pinned in data/universities.json meta.context.rail) as quiet
 * context on the map: operating stations only — a station under construction is a project, not a service, and is not
 * drawn (the site panel names the nearest one in words). A station is a click target: it opens the station panel
 * (campus sites within 1 km in a straight line), whose radius is drawn as a dashed circle. Foundation colours from the
 * theme (context marks, not a data scale or a category): card fill, secondary-text stroke, selected stroke; the name
 * from zoom 13.5 in the basemap's own font.
 */
import {GEOJSON_MAXZOOM} from './map-layers.js';

export const STATION_MIN_ZOOM = 10.5;
export const STATION_LAYERS = Object.freeze({radius: 'uni-station-radius', ring: 'uni-station-ring', label: 'uni-station-label', selected: 'uni-station-selected'});
const SOURCE = 'uni-stations', SELECTED = 'uni-station-selected', RADIUS = 'uni-station-radius';
const EMPTY = {type: 'FeatureCollection', features: []};

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}

/** A circle of `metres` round a point as a closed lon/lat ring (display only: the radius the panel counts in). */
export function circleRing(lon, lat, metres, steps = 72) {
  const dLat = metres / 110574, dLon = metres / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({length: steps}, (_, i) => { const a = (i / steps) * 2 * Math.PI; return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]; });
  return [...ring, ring[0]];
}

/** Operating stations as GeoJSON points (reference point unchanged). */
export function stationCollection(stations = []) {
  return {type: 'FeatureCollection', features: stations.filter(s => s.status === 'operating' && Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map(s => ({type: 'Feature', geometry: {type: 'Point', coordinates: [s.lon, s.lat]}, properties: {id: s.id, name: s.name}}))};
}

export function installStationLayer(map, stations = []) {
  const data = stationCollection(stations);
  const byId = new Map(data.features.map(f => [f.properties.id, f]));
  map.addSource(SOURCE, {type: 'geojson', data, maxzoom: GEOJSON_MAXZOOM});
  map.addSource(SELECTED, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});
  map.addSource(RADIUS, {type: 'geojson', data: EMPTY, maxzoom: GEOJSON_MAXZOOM});
  map.addLayer({id: STATION_LAYERS.radius, type: 'line', source: RADIUS,
    paint: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.9}});
  map.addLayer({id: STATION_LAYERS.ring, type: 'circle', source: SOURCE, minzoom: STATION_MIN_ZOOM,
    paint: {'circle-radius': ['interpolate', ['linear'], ['zoom'], STATION_MIN_ZOOM, 2.2, 13, 3.4, 16, 5.5],
      'circle-color': cssVar('--surface-card', '#FCFCFA'), 'circle-stroke-color': cssVar('--text-secondary', '#4E5B52'),
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], STATION_MIN_ZOOM, 0.8, 14, 1.6]}});
  map.addLayer({id: STATION_LAYERS.label, type: 'symbol', source: SOURCE, minzoom: 13.5,
    layout: {'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.9], 'text-optional': true, 'text-max-width': 8},
    paint: {'text-color': cssVar('--text-secondary', '#4E5B52'), 'text-halo-color': cssVar('--surface-card', '#FCFCFA'), 'text-halo-width': 1.4}});
  map.addLayer({id: STATION_LAYERS.selected, type: 'circle', source: SELECTED,
    paint: {'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': cssVar('--map-selected-stroke', '#176B82'), 'circle-stroke-width': 2.5}});

  /** Mark the open station and draw its counting radius (metres), or clear both. */
  function select(id, radius = 0) {
    const f = id ? byId.get(id) : null;
    map.getSource(SELECTED)?.setData(f ? {type: 'FeatureCollection', features: [f]} : EMPTY);
    const [lon, lat] = f ? f.geometry.coordinates : [];
    map.getSource(RADIUS)?.setData(f && radius > 0 ? {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: circleRing(lon, lat, radius)}}]} : EMPTY);
  }
  /** The station id under a screen point ('' when none). */
  function hitTest(point, radius = 7) {
    if (!map.getLayer(STATION_LAYERS.ring) || map.getZoom() < STATION_MIN_ZOOM) return '';
    const hits = map.queryRenderedFeatures([[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]], {layers: [STATION_LAYERS.ring]});
    let best = '', bestD = Infinity;
    for (const h of hits) {
      const f = byId.get(h.properties?.id);
      if (!f) continue;
      const p = map.project(f.geometry.coordinates), d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      if (d < bestD) { bestD = d; best = f.properties.id; }
    }
    return best;
  }
  function dispose() {
    for (const id of Object.values(STATION_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [SOURCE, SELECTED, RADIUS]) if (map.getSource(id)) map.removeSource(id);
  }
  return {select, hitTest, dispose, layerIds: STATION_LAYERS, count: data.features.length};
}
