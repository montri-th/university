/**
 * Categorical identity of the institution types — LDS 0.9.7 DATAVIZ-05 (`landometer-series-10-v8`).
 *
 * Every type is bound by its stable id to one series: the fill comes from the theme's `--series-N-fill`
 * (assets/theme.css, exact LDS values per theme) and the shape cue is the one LDS assigns to that series
 * slot (circle, square, triangle, diamond, cross, star, hexagon, ring, dash, plus). The cue is the
 * non-colour channel on the map, in legends and in lists; a text label accompanies every legend and list.
 * Assignments never change with filtering or sorting.
 *
 * Mapping (presentation only, fixed by id, not a ranking): autonomous public universities the circle (1), Rajabhat
 * universities the square (2), private universities the triangle (3), the two open-admission universities the diamond
 * (4), Rajamangala universities the cross (5), selective public universities the hexagon (7), institutions outside
 * MHESI the grey-teal dash (9), private institutes and colleges the plus (10). The star (series 6) is not used: it would
 * read as a rating, which this product never shows. Ring (8) stays free.
 */
export const CUES = Object.freeze(['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'hexagon', 'ring', 'dash', 'plus']);

/** type id → series number (1–10). */
export const GROUP_SERIES = Object.freeze({
  autonomous: 1, rajabhat: 2, private: 3, open: 4, rmut: 5, public: 7, private_other: 10, outside: 9,
});
export const seriesOf = groupId => GROUP_SERIES[groupId] || 9;
export const cueOf = series => CUES[(series || 9) - 1];

/** 12 × 12 viewBox paths, centred on (6, 6); the ring uses the even-odd rule. */
export const CUE_PATHS = Object.freeze({
  circle: 'M6 1.2a4.8 4.8 0 1 1 0 9.6a4.8 4.8 0 1 1 0-9.6z',
  square: 'M1.8 1.8h8.4v8.4H1.8z',
  triangle: 'M6 1.1l5.2 9.3H0.8z',
  diamond: 'M6 0.8l5.2 5.2L6 11.2L0.8 6z',
  cross: 'M8.62 1.40L10.60 3.38L7.98 6.00L10.60 8.62L8.62 10.60L6.00 7.98L3.38 10.60L1.40 8.62L4.02 6.00L1.40 3.38L3.38 1.40L6.00 4.02Z',
  star: 'M6.00 0.90L7.35 4.44L11.14 4.63L8.19 7.01L9.17 10.67L6.00 8.60L2.83 10.67L3.81 7.01L0.86 4.63L4.65 4.44Z',
  hexagon: 'M6 1l4.5 2.5v5L6 11L1.5 8.5v-5z',
  ring: 'M6 1.2a4.8 4.8 0 1 1 0 9.6a4.8 4.8 0 1 1 0-9.6zM6 3.7a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z',
  dash: 'M0.8 4.4h10.4v3.2H0.8z',
  plus: 'M4.6 1h2.8v3.6H11v2.8H7.4V11H4.6V7.4H1V4.6h3.6z',
});

/** Inline SVG cue for HTML (legend swatches, list bullets, pins). Decorative: the text label carries the meaning. */
export function cueMarkup(series, {className = ''} = {}) {
  const name = cueOf(series);
  return `<svg class="cue-shape category-${series}${className ? ' ' + className : ''}" data-cue="${name}" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="${CUE_PATHS[name]}" fill-rule="evenodd"/></svg>`;
}

/**
 * Raster icon for a MapLibre symbol layer: the cue filled with `fill`, outlined
 * with `stroke`, on a transparent ground. Returns {width, height, data} at
 * `pixelRatio` (pass the same ratio to map.addImage). Browser only.
 * `hollow`: the no-data variant (unknown students) — the same shape as an open outline in the series fill, edged with
 * `stroke` on both sides, nothing inside; drawn a little inset so the wide outline stays inside the box.
 */
export function cueImage(series, {size = 16, pixelRatio = 2, fill = '#8AA4AA', stroke = '#182327', strokeWidth = 1.1, hollow = false} = {}) {
  const px = Math.round(size * pixelRatio);
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(px, px) : Object.assign(document.createElement('canvas'), {width: px, height: px});
  const ctx = canvas.getContext('2d');
  // The paths keep ≥ 0.8 unit of margin inside the 12-unit box, enough for the outline at these sizes.
  const inset = hollow ? 0.8 : 1;
  const scale = (px / 12) * inset;
  ctx.setTransform(scale, 0, 0, scale, (px - 12 * scale) / 2, (px - 12 * scale) / 2);
  const path = new Path2D(CUE_PATHS[cueOf(series)]);
  ctx.lineJoin = 'round';
  if (hollow) {
    ctx.lineWidth = (4.4 * pixelRatio) / scale;
    ctx.strokeStyle = stroke;
    ctx.stroke(path);
    ctx.lineWidth = (2.4 * pixelRatio) / scale;
    ctx.strokeStyle = fill;
    ctx.stroke(path);
  } else {
    ctx.fillStyle = fill;
    ctx.fill(path, 'evenodd');
    ctx.lineWidth = (strokeWidth * pixelRatio) / scale;
    ctx.strokeStyle = stroke;
    ctx.stroke(path);
  }
  const image = ctx.getImageData(0, 0, px, px);
  return {width: px, height: px, data: new Uint8Array(image.data.buffer)};
}
