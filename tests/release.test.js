/**
 * Release consistency: one cache tag on every entry file AND every ES module (import map), one product version
 * across package.json, design-intent.json and the handoff JSON, and publication hygiene of the whole tree.
 * A browser must never pair an entry from this release with a module cached from the previous one (GitHub Pages
 * caches ~10 min); the campus file takes the same tag from import.meta.url (js/app.js#RELEASE).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT, readJSON} from './helpers.js';

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const modules = () => [
  ...readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'launch.js').map(f => `js/${f}`),
  ...readdirSync(join(ROOT, 'js/vendor')).filter(f => f.endsWith('.js')).map(f => `js/vendor/${f}`),
  ...readdirSync(join(ROOT, 'js/shell')).filter(f => f.endsWith('.js') && f !== 'launch.js').map(f => `js/shell/${f}`),
];

test('one cache tag on every entry file and every module in the import map', () => {
  const tags = [...html.matchAll(/\?v=([0-9A-Za-z-]+)/g)].map(m => m[1]);
  assert.ok(tags.length >= 6 + modules().length, `${tags.length} tags`);
  const tag = tags[0];
  assert.match(tag, /^\d{8}-r\d{1,2}$/);
  assert.deepEqual([...new Set(tags)], [tag], 'a single cache tag across index.html');

  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const expected = Object.fromEntries(modules().sort().map(m => [`./${m}`, `./${m}?v=${tag}`]));
  assert.deepEqual(map, expected, 'every ES module (except the classic launch.js) is mapped to its tagged URL');
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'the import map precedes every module script');

  // Every static relative import in js/ resolves to a mapped module.
  for (const m of modules()) {
    const src = readFileSync(join(ROOT, m), 'utf8');
    for (const [, spec] of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const resolved = new URL(spec, `https://x.test/${m}`).pathname.slice(1);
      assert.ok(map[`./${resolved}`], `${m} imports ${spec} → ${resolved} is not in the import map`);
    }
  }
  // The campus file is versioned with the same tag, read from the module URL (not a second constant).
  assert.match(readFileSync(join(ROOT, 'js/app.js'), 'utf8'), /new URL\(import\.meta\.url\)\.searchParams\.get\('v'\)/);
  assert.equal(readJSON('handoff/product-brief.json').delivery.cacheTag.slice(3, 3 + tag.length), tag, 'the brief names the shipped tag');
});

test('one product version across package.json, design intent and the handoff JSON', () => {
  const version = readJSON('package.json').version;
  for (const f of ['design-intent.json', 'handoff/product-brief.json', 'handoff/implementation-plan.json', 'handoff/product-statement.json']) {
    assert.equal(readJSON(f).productVersion, version, f);
  }
  for (const f of ['handoff/product-brief.json', 'handoff/implementation-plan.json', 'handoff/product-statement.json']) {
    const doc = readJSON(f);
    assert.equal(doc.schemaVersion, '1.5.0', f);
    assert.equal(doc.productId, 'citymeter-university', f);
  }
  assert.equal(readJSON('handoff/handoff.schema.json').properties.productId.const, 'citymeter-university');
});

test('publication hygiene: no private document links, credentials, research sheet or LDS library in the tree', () => {
  const skip = new Set(['.git', 'node_modules', 'evidence', 'dist', '.handoff-stage']); // git-ignored outputs
  const files = [];
  const walk = dir => { for (const name of readdirSync(dir)) { if (skip.has(name)) continue; const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
  walk(ROOT);
  const google = ['docs', 'drive'].map(h => `${h}.${['google', 'com'].join('.')}`);
  const secret = /(gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  for (const p of files) {
    const rel = relative(ROOT, p);
    assert.ok(!/\.(xlsx|xls|ods|csv)$/i.test(rel), `${rel}: no spreadsheet in the tree`);
    assert.ok(!/Landometer-Design-System|Location-Intelligence-Profile/.test(rel), `${rel}: the LDS library is not distributed`);
    if (!/\.(js|mjs|json|geojson|md|html|css|py|txt|webmanifest)$/.test(rel)) continue;
    const text = readFileSync(p, 'utf8');
    for (const host of google) assert.ok(!text.includes(host), `${rel}: no ${host} link`);
    assert.ok(!secret.test(text), `${rel}: no credential-like string`);
    // The research master's and the dataset registry's addresses, known here only by their SHA-256.
    for (const [token] of text.matchAll(/[A-Za-z0-9_-]{40,48}/g)) {
      assert.ok(!PRIVATE_SHEETS.has(createHash('sha256').update(token).digest('hex')), `${rel}: a private sheet address`);
    }
  }
});
const PRIVATE_SHEETS = new Set(['261e556ac29478c99cbba245d646c55e7a38eed7cf8bb07211db1797fa378f4c', '656ea9951755c242dce6a16b06c81654c26adf0006d5f0c1bb9f9c967f6e8a25']);

/** A small JSON Schema subset (type object, required, properties, items, minItems, const, enum, pattern, allOf + if/then). */
function validate(schema, value, path = '$', errors = []) {
  if (!schema || typeof schema !== 'object') return errors;
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) errors.push(`${path}: const`);
  if (schema.enum && !schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) errors.push(`${path}: enum`);
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern`);
  if (schema.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) errors.push(`${path}: object`);
  if (schema.type === 'array' && !Array.isArray(value)) errors.push(`${path}: array`);
  if (schema.required && value && typeof value === 'object') for (const k of schema.required) if (!(k in value)) errors.push(`${path}.${k}: required`);
  if (schema.minItems && Array.isArray(value) && value.length < schema.minItems) errors.push(`${path}: minItems ${schema.minItems}`);
  if (schema.properties && value && typeof value === 'object') for (const [k, s] of Object.entries(schema.properties)) if (k in value) validate(s, value[k], `${path}.${k}`, errors);
  if (schema.items && Array.isArray(value)) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  for (const part of schema.allOf || []) {
    if (part.if) { if (!validate(part.if, value, path, []).length) validate(part.then, value, path, errors); }
    else validate(part, value, path, errors);
  }
  return errors;
}

test('the handoff JSON satisfies its schema (statement, brief, plan)', () => {
  const schema = readJSON('handoff/handoff.schema.json');
  for (const f of ['handoff/product-statement.json', 'handoff/product-brief.json', 'handoff/implementation-plan.json']) {
    assert.deepEqual(validate(schema, readJSON(f)), [], f);
  }
  // The validator itself catches a missing contract.
  const brief = {...readJSON('handoff/product-brief.json')};
  delete brief.firstAha;
  assert.ok(validate(schema, brief).some(e => e.includes('firstAha')));
});

test('every GeoJSON source the page adds sets GEOJSON_MAXZOOM, two levels above the building camera (MapLibre 5.6.2 throws below it under a pitched camera)', async () => {
  const {GEOJSON_MAXZOOM} = await import('../js/map-layers.js');
  const {BUILDING_MAX_ZOOM} = await import('../js/shell/camera.js');
  assert.ok(GEOJSON_MAXZOOM <= 24, 'geojson-vt allows at most 24');
  assert.ok(GEOJSON_MAXZOOM - BUILDING_MAX_ZOOM >= 2, `${GEOJSON_MAXZOOM} vs building camera ${BUILDING_MAX_ZOOM}`);
  let n = 0;
  for (const m of modules()) {
    const src = readFileSync(join(ROOT, m), 'utf8');
    for (const [call] of src.matchAll(/addSource\([^;]*?type: 'geojson'[^;]*?\);/g)) { n++; assert.match(call, /maxzoom: GEOJSON_MAXZOOM/, `${m}: ${call.slice(0, 90)}`); }
  }
  assert.ok(n >= 6, `found ${n} GeoJSON sources`);
});
