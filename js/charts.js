/**
 * Comparison charts rendered as plain HTML — no chart vendor.
 *
 * Three views share the committed selection (the filtered units) and the map's measure:
 *  - provinces (URL view key `provinces`): the measure per province, bars in the map's colour (the same 41-sample
 *    rank ramp over the same provinces, js/provinces.js#buildProvinceModel)
 *  - types: the measure per institution type, bars in the type's series colour + shape cue
 *  - unis: the universities of the selection ranked by the measure (a university with units in several provinces sums
 *    the units of the selection), bars in the type's series colour
 * Province marks emit {type:'province', id}; type marks {type:'type', id}; university marks {type:'uni', id}.
 */
import {buildMetricRamp, classify} from './scales.js';
import {cueMarkup} from './cues.js';
import {provinceByCode, provinceTotals, typeMixOf, universitiesOf} from './model.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = n => NUMBER.format(n);
const COLLATOR = new Intl.Collator('th');

function empty(element, message) {
  element.innerHTML = `<div class="chart-empty"><p>${esc(message)}</p></div>`;
}

const otherOf = (x, unit) => (unit.id === 'units' ? `${num(x.students)} คน` : `${num(x.count)} หน่วยรายงาน`);

function bars(element, items, {unit, caption, attr, label, sub, fill, selected = '', limit = 30}) {
  const list = items.filter(x => x.value > 0).slice(0, limit);
  if (!list.length) { empty(element, `ไม่มี${unit.subject}ในตัวกรองนี้`); return; }
  const max = Math.max(1, ...list.map(x => x.value));
  element.innerHTML = `<p class="chart-caption">${esc(caption)}</p><ol class="chart-bars">${list.map((x, i) => {
    const pressed = x.id === selected;
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-${attr}="${esc(x.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(label(x))}: ${num(x.value)} ${esc(unit.one)} ${esc(sub(x))}">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${x.series ? cueMarkup(x.series) : ''}${esc(label(x))}<small>${esc(sub(x))}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill${fill(x) ? '' : ` category-${x.series}`}" style="width:${Math.max(2, Math.round((x.value / max) * 100))}%${fill(x) ? `;background:${fill(x)}` : ''}"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(x.value)}</b><small>${esc(unit.one)}</small></span>
    </button></li>`;
  }).join('')}</ol>`;
}

/**
 * view: provinces | types | unis. units: the filtered units without the province filter (provinces view) and with it
 * (the others). Returns a dispose function.
 */
export function renderInsightChart({elementId, view = 'provinces', units = [], allUnits = units, types = [], unit, metric = 'students', province = '', selectedUni = ''} = {}, onSelect = () => {}) {
  const element = document.getElementById(elementId);
  if (!element) return () => {};
  if (view === 'types') {
    const list = typeMixOf(units, types, metric).sort((a, b) => b.value - a.value || a.index - b.index);
    bars(element, list, {unit, attr: 'type', caption: `${unit.subject}ต่อประเภทสถาบัน${province ? ` · ${provinceByCode(province)?.th || ''}` : ''}`, label: t => t.th, sub: t => otherOf(t, unit), fill: () => ''});
  } else if (view === 'unis') {
    const list = universitiesOf(units, metric);
    bars(element, list, {unit, attr: 'uni', selected: selectedUni, caption: `มหาวิทยาลัยที่มี${unit.subject}มากที่สุด${province ? ` · ${provinceByCode(province)?.th || ''}` : ''} · ${num(list.length)} แห่ง`, label: x => x.name, sub: x => [x.type?.short, otherOf(x, unit)].filter(Boolean).join(' · '), fill: () => ''});
  } else {
    const totals = [...provinceTotals(allUnits, metric).values()];
    const ramp = buildMetricRamp(totals.map(p => p.value), {metric, unit: unit.one});
    const list = totals.map(p => ({...p, id: p.code, name: provinceByCode(p.code)?.th || p.code}))
      .sort((a, b) => b.value - a.value || COLLATOR.compare(a.name, b.name));
    bars(element, list, {unit, attr: 'province', selected: province, caption: `${unit.subject}ต่อจังหวัด · ${num(list.length)} จังหวัดที่มีหน่วยรายงาน · สีเดียวกับแผนที่`, label: x => x.name, sub: x => otherOf(x, unit), fill: x => classify(x.value, ramp).fill});
  }
  const handlers = [['province', 'province'], ['type', 'type'], ['uni', 'uni']];
  for (const [attr, type] of handlers) element.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => onSelect({type, id: b.dataset[attr]})));
  return () => { element.innerHTML = ''; };
}
