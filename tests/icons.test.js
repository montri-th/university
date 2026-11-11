/**
 * Icon fonts: the shipped files match their contracts, and the stylesheets address each font by its content
 * (`?v=` = the first 8 hex of its SHA-256). The live walk of 0.3.0 found Chrome rendering the new pictograms
 * (ai, streetview, maps, building) as empty boxes: it kept the 0.2.1 font binary for the same unversioned URL.
 * A content-addressed URL changes exactly when the font changes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, sha256} from './helpers.js';
import {PICTOGRAM_CONTRACT, NAV_ICON_CONTRACT} from '../js/navigation.js';

for (const [name, contract, css] of [['pictogram', PICTOGRAM_CONTRACT, 'styles.css'], ['nav-7', NAV_ICON_CONTRACT, 'navigation.css']]) {
  test(`${name} font: file = contract, stylesheet URL carries its content hash`, () => {
    const file = join(ROOT, contract.file);
    const hash = sha256(readFileSync(file));
    assert.equal(hash, contract.sha256, `${contract.file} sha256`);
    assert.equal(statSync(file).size, contract.bytes, `${contract.file} bytes`);
    const text = readFileSync(join(ROOT, css), 'utf8');
    const urls = [...text.matchAll(new RegExp(`url\\("(${contract.file.replace(/[.]/g, '\\.')}[^"]*)"\\)`, 'g'))].map(m => m[1]);
    assert.deepEqual(urls, [`${contract.file}?v=${hash.slice(0, 8)}`], `${css} addresses the font by content`);
  });
}

test('pictogram manifest and the glyphs the contract names agree', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'assets/icons/material-pictogram-300.json'), 'utf8'));
  assert.equal(manifest.sha256, PICTOGRAM_CONTRACT.sha256);
  assert.equal(manifest.bytes, PICTOGRAM_CONTRACT.bytes);
  assert.deepEqual(Object.keys(manifest.glyphs).sort(), Object.keys(PICTOGRAM_CONTRACT.glyphs).sort());
  for (const [k, g] of Object.entries(manifest.glyphs)) assert.equal(g.codepoint, `U+${PICTOGRAM_CONTRACT.glyphs[k].codePointAt(0).toString(16).toUpperCase()}`, k);
});
