/**
 * View models of the reading panel. Pure: data in, plain objects out (js/panel.js renders them).
 *
 * Two grains (DATA_METHOD.md §2): the measure is read over reporting units by the province the source names for each;
 * sites are places on the map and carry no students of their own. A site shows its linked unit's figure as that
 * unit's (“นักศึกษาตามหน่วยรายงาน …”), a faculty its academic unit's figure (02_ACADEMIC_UNITS, same file), never
 * people on a campus or in a building. Distances are straight lines between reference points.
 */
import {summarize, typeMixOf, siteTypeMixOf, provinceTotals, universitiesOf, unitValue, distanceM, hasPoint, siteOrder, unitOrder} from './model.js';

const COLLATOR = new Intl.Collator('th');
/** A station's radius: the sites whose reference point lies within it (straight line). */
export const STATION_RADIUS_M = 1000;

/** Provinces ranked by the measure (each with its value, units and students). */
export function rankProvinces(units, {metric = 'students', nameOf = c => c} = {}) {
  return [...provinceTotals(units, metric).values()].map(p => ({...p, id: p.code, name: nameOf(p.code)}))
    .filter(p => p.value > 0).sort((a, b) => b.value - a.value || b.students - a.students || COLLATOR.compare(a.name, b.name));
}

/** Stations of CityMETER · Transit with the most sites (with a point) within `radius`, each site at its nearest one. */
export function stationsOf(sites, stations, {radius = STATION_RADIUS_M, limit = 6} = {}) {
  const by = new Map();
  for (const s of sites) {
    if (!hasPoint(s) || !s.rail || s.rail.m > radius) continue;
    let x = by.get(s.rail.station.id);
    if (!x) by.set(s.rail.station.id, x = {station: s.rail.station, count: 0, sites: []});
    x.count++; x.sites.push(s);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || COLLATOR.compare(a.station.name, b.station.name)).slice(0, limit);
}

/**
 * The overview of the selection: Thailand, or the province of the จังหวัด filter.
 * units/sites: the filtered scope (sites already narrowed to the province by the filter); allUnits: every unit of the
 * filters without the province (the province's national rank).
 */
export function buildOverview(units, sites, {province = '', types = [], metric = 'students', allUnits = units, nameOf = c => c, stations = []} = {}) {
  const summary = summarize(units);
  const located = sites.filter(hasPoint);
  const overview = {
    province, summary, metric,
    types: typeMixOf(units, types, metric),
    levels: {ba: summary.ba, ma: summary.ma, phd: summary.phd, other: summary.other, total: summary.students},
    sites: {count: sites.length, located: located.length, extents: sites.filter(s => s.extent >= 0).length,
      faculties: sites.filter(s => s.faculties).length, offerings: sites.filter(s => s.offerings).length,
      linked: sites.filter(s => s.unit).length, rail: located.filter(s => s.rail && s.rail.m <= STATION_RADIUS_M).length,
      byType: siteTypeMixOf(sites, types)},
    stations: stationsOf(sites, stations),
  };
  if (!province) {
    overview.provinces = rankProvinces(units, {metric, nameOf});
  } else {
    overview.universities = universitiesOf(units.filter(u => u.province === province), metric);
    const ranked = rankProvinces(allUnits, {metric, nameOf});
    const i = ranked.findIndex(p => p.code === province);
    overview.rank = i >= 0 ? {rank: i + 1, of: ranked.length} : null;
    overview.sitesList = [...sites].sort(siteOrder);
    overview.otherSites = 0;
  }
  return overview;
}

/** A site's faculties (31 → 30) with each one's geometry, from the campus file (null until it has loaded). */
export function facultiesOf(site, siteIndex, campus) {
  if (!campus) return null;
  const list = campus.faculties.get(siteIndex) || [];
  return list.map(f => ({...f, geometry: f.geoms.map(i => campus.geometry[i]).filter(Boolean)}));
}

/** Programmes and fees of a site (32 → 33/36), grouped by the source's faculty label, in the source's order. */
export function offeringsOf(siteIndex, campus) {
  if (!campus) return null;
  const list = campus.offerings.get(siteIndex) || [];
  const by = new Map();
  for (const o of list) { let a = by.get(o.faculty); if (!a) by.set(o.faculty, a = []); a.push(o); }
  return [...by].map(([faculty, offerings]) => ({faculty, offerings}));
}

/** Other sites near a site (straight line ≤ radius), nearest first: the context round a campus. */
export function sitesNear(site, sites, {radius = 3000, limit = 8} = {}) {
  if (!hasPoint(site)) return [];
  const out = [];
  for (const s of sites) {
    if (s === site || !hasPoint(s)) continue;
    const d = distanceM(site.latitude, site.longitude, s.latitude, s.longitude);
    if (d <= radius) out.push({site: s, d});
  }
  return out.sort((a, b) => a.d - b.d || COLLATOR.compare(a.site.name, b.site.name)).slice(0, limit);
}

export function buildSiteDetail(site, {data, campus = null, siteIndex = -1, building = null} = {}) {
  const uni = site.uni;
  return {
    site, uni, unit: site.unit, link: site.link,
    faculties: facultiesOf(site, siteIndex, campus),
    offerings: offeringsOf(siteIndex, campus),
    quality: campus ? campus.quality.get(uni.index) || [] : null,
    siblings: uni.sites.filter(s => s !== site),
    near: sitesNear(site, data.sites),
    building,
    campusLoaded: Boolean(campus),
  };
}

export function buildUniversityProfile(uni, {campus = null, metric = 'students'} = {}) {
  const units = [...uni.units].sort(unitOrder);
  const provinces = [...new Set(units.map(u => u.province))];
  const summary = summarize(units);
  return {uni, units, sites: [...uni.sites].sort(siteOrder), provinces, summary, metric,
    quality: campus ? campus.quality.get(uni.index) || [] : null, fees: uni.fees, campusLoaded: Boolean(campus)};
}

export function buildUnitProfile(unit) {
  const faculties = [...unit.faculties].sort((a, b) => b.students - a.students || COLLATOR.compare(a.name, b.name));
  return {unit, uni: unit.uni, site: unit.site, faculties,
    levels: {ba: unit.ba, ma: unit.ma, phd: unit.phd, other: unit.other, total: unit.students},
    others: unit.uni.units.filter(u => u !== unit)};
}

/** The sites whose point lies within `radius` of a station (straight line), nearest first. */
export function buildStationProfile(station, {sites, radius = STATION_RADIUS_M} = {}) {
  const rows = [];
  for (const s of sites) {
    if (!hasPoint(s)) continue;
    const d = distanceM(station.lat, station.lon, s.latitude, s.longitude);
    if (d <= radius) rows.push({site: s, d});
  }
  rows.sort((a, b) => a.d - b.d || COLLATOR.compare(a.site.name, b.site.name));
  return {station, radius, rows: rows.map(r => r.site), distance: new Map(rows.map(r => [r.site.id, r.d])),
    linked: rows.filter(r => r.site.unit).length};
}

/**
 * A drawn building of an open site: the faculty geometries whose point falls in it (js/app.js joins them), and the
 * faculties that list those geometries. Display only — “คณะในอาคารนี้” is a footprint the research team selected, not a
 * claim about floors, rooms or who studies there.
 */
export function buildBuildingProfile(sel, {campus, siteIndex}) {
  const geomIds = new Set((sel?.geoms || []).map(g => g.index));
  const faculties = (campus?.faculties.get(siteIndex) || []).filter(f => f.geoms.some(i => geomIds.has(i)));
  return {key: sel?.key || '', kind: sel?.kind || 'osm', height: sel?.height ?? null, geoms: sel?.geoms || [], faculties, site: sel?.site || null};
}

/** Share helpers for the charts and tests. */
export const totalOf = (units, metric = 'students') => units.reduce((s, u) => s + unitValue(u, metric), 0);
