/**
 * The Aha of the first screen (Hotel 0.3.x “Aha first”, made for this dataset's grain): where the reported students
 * of the MHESI student file concentrate.
 *
 *  - Thailand (no จังหวัด filter): up to three provinces with the most of the measure, their share of the whole
 *    total (numerator and denominator), the same share without the open-admission universities (Ramkhamhaeng and
 *    Sukhothai Thammathirat report every student under the province of their head office — the bar names them, so the
 *    reader sees the difference without a caveat), and the provinces where no unit reports under the filters
 *    (measured zero of this file, never “no university”).
 *  - A province: up to three universities with the most of the measure among the units the source names under that
 *    province, and their share of the province's total.
 * Never cut through a tie (a 3rd and 4th place with the same value → two), never focus every item that holds the
 * measure. Membership is the unit's own province field; nothing is re-assigned by a point. Pure.
 */
import {provinceTotals, universitiesOf, unitValue} from './model.js';

const COLLATOR = new Intl.Collator('th');

/** The first k of a ranked list, k ≤ limit, never cutting through a tie; 0 when every item ties or one item holds everything. */
export function topWithoutTie(ranked, limit = 3, value = x => x.value) {
  let k = Math.min(limit, ranked.length);
  // Focusing every item that holds the measure says nothing about concentration (one item alone is its own finding).
  const positive = ranked.filter(x => value(x) > 0).length;
  if (positive > 1 && k >= positive) k = positive - 1;
  while (k > 0 && k < ranked.length && value(ranked[k - 1]) === value(ranked[k])) k--;
  return ranked.slice(0, k);
}

/**
 * units: the filtered units (scope, before any focus); provinces: [{code, name}] of the area index; metric.
 * Returns {mode: 'national'|'province', items, ids, value, total, count, comparison, zero, spread, home}.
 */
export function summarizeInsight(units = [], {metric = 'students', province = '', provinces = [], nameOf = c => c} = {}) {
  const total = units.reduce((s, u) => s + unitValue(u, metric), 0);
  if (!province) {
    const by = provinceTotals(units, metric);
    const ranked = [...by.values()].filter(p => p.value > 0).map(p => ({...p, id: p.code, name: nameOf(p.code)}))
      .sort((a, b) => b.value - a.value || b.students - a.students || COLLATOR.compare(a.name, b.name));
    const top = topWithoutTie(ranked);
    const ids = top.map(p => p.code);
    const value = top.reduce((s, p) => s + p.value, 0);
    // The same provinces without the open-admission universities (students only; the units measure counts reporting paths).
    let comparison = null;
    const open = units.filter(u => u.type?.id === 'open');
    if (metric === 'students' && open.length && top.length) {
      const set = new Set(ids), rest = units.filter(u => u.type?.id !== 'open');
      const restTotal = rest.reduce((s, u) => s + u.students, 0);
      const restIn = rest.filter(u => set.has(u.province)).reduce((s, u) => s + u.students, 0);
      if (restTotal) comparison = {value: restIn, total: restTotal, excluded: [...new Set(open.map(u => u.uni.name))]};
    }
    const zero = provinces.map(p => p.code).filter(c => !by.has(c));
    return {mode: 'national', items: top, ids, value, total, count: top.reduce((s, p) => s + p.count, 0), comparison, zero,
      spread: !top.length && ranked.length > 0, home: '', ranked};
  }
  const inProvince = units.filter(u => u.province === province);
  const ranked = universitiesOf(inProvince, metric).filter(x => x.value > 0);
  const top = topWithoutTie(ranked);
  const provinceTotal = inProvince.reduce((s, u) => s + unitValue(u, metric), 0);
  return {mode: 'province', items: top, ids: top.map(x => x.id), value: top.reduce((s, x) => s + x.value, 0), total: provinceTotal,
    count: top.reduce((s, x) => s + x.count, 0), comparison: null, zero: [], spread: !top.length && ranked.length > 0, home: province, ranked,
    nationalTotal: total};
}
