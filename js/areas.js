/**
 * Administrative areas: จังหวัด (PROVINCE, the finest area of this dataset: the MHESI student file names a province for
 * each reporting unit) and เขต/อำเภอ (DISTRICT: where a campus site's point lies, named on the site, never a place its
 * students are counted in), from CityMETER production base info and boundaries.
 *
 * The index (data/area-index.json) holds every one of the 928 districts and 77 provinces — names, production codes,
 * production areaSqm, a label point and a bbox — without geometry, so ranks, search, breadcrumbs and camera fits work
 * at once.
 */
const km2 = sqm => (Number.isFinite(sqm) && sqm > 0 ? sqm / 1e6 : null);

export function buildAreaIndex(json) {
  const byId = new Map(), provinceById = new Map();
  for (const p of json?.provinces || []) {
    provinceById.set(p.id, {id: p.id, code: p.id, dopa: p.code, uuid: p.uuid, name: p.name, nameEn: p.nameEn, km2: km2(p.areaSqm),
      label: p.label || null, bbox: p.bbox || null, areaTotal: p.districts});
  }
  const a = json?.areas || {id: []};
  for (let i = 0; i < a.id.length; i++) {
    const id = a.id[i];
    byId.set(id, {id, name: a.name[i], nameEn: a.nameEn[i] || '', province: a.province[i], km2: km2(a.areaSqm[i]),
      label: a.label[i] || null, bbox: a.bbox[i] || null, feature: null});
  }
  return {byId, provinceById, areas: [...byId.values()], provinces: [...provinceById.values()]};
}

/** District word in Bangkok (เขต) vs elsewhere (อำเภอ). */
export const areaWord = province => (province === 'BKK' ? 'เขต' : 'อำเภอ');
export const levelWords = province => ({area: areaWord(province)});
/** The district's own name already starts with เมือง… — "อำเภอเมืองภูเก็ต"; Bangkok: "เขตวัฒนา". */
export const areaLabel = a => (a ? `${areaWord(a.province)}${a.name}` : '');
