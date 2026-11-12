# CityMETER University — verification

## Release 0.1.1 — 12 พ.ย. 2569

Fixes from the first walk of the live site (0.1.0 on GitHub Pages, owner's Chrome, desktop, dark theme):

- A campus lit every drawn building of its focus instead of its faculty buildings (Kasetsart Bang Khen: 406 pieces for 24 faculty buildings): `highlightIds` now takes the join's `byBuilding` only.
- The building panel showed a faculty's students next to “คณะในอาคารนี้” (e.g. 5,937 คน), which reads as people in the building: it now lists faculty names only; on a campus the faculty figure reads “N คนตามหน่วยรายงาน” (`tests/views.test.js`).
- English: the terrain credit (“| ภูมิประเทศ:”), the OSM date in the provenance line, the CityMETER Building V4 legend titles and the building tab title were Thai on the live site (none of them appear without the real basemap, terrain and building tiles): now translated.
- The faculty records no longer carry the research master's academic-unit context id (`ctx`, unused by the page); `data/campus.json` rebuilt from the same inputs, otherwise equal; the other data files byte-identical.

Local: 153 tests pass; English harvest of every view clean. Live results for 0.1.1 follow below once published.

## Release 0.1.0 — 12 พ.ย. 2569

ผลตรวจของรุ่นแรก แยกสิ่งที่ตรวจในเครื่องสร้าง (build container) ออกจากสิ่งที่ตรวจบนเว็บจริง ผลในเครื่องไม่ใช่หลักฐานแทน live URL

### 1. Data build — every reconciliation passes

- Input: the owner's .xlsx export of the research master (SHA-256 `38661fa5…cf22`, 34,516,435 bytes), 43 tabs converted with `scripts/xlsx-to-csv.py`; the converter reproduced all 43 tab hashes a second time.
- `scripts/build-data.py` stopped on no check; outputs: 303 units, 1,786,753 students (= `20_INSTITUTION_CONTEXTS`), 170 universities, 190 sites (188 points, 164 extents, 135 linked), 388 geometries, 210 faculty memberships, 503 programmes, 627 fee lines, 162 roster points, 301 stations, 15 logos (each equal to `LOGO_LIBRARY.logo_sha256`).
- Rebuilt from the same inputs after removing the sheet's address from the build: the data equalled the first build of the day apart from that field; logos byte-identical.
- Reported, not patched (`meta.checks`, `DATA_METHOD.md` §12): 3 site/unit province conflicts, 14 roster points in another province (not drawn), 2 sites without a point, 3 sites outside the building units, 2 unit-site rows without a campus site, 1 point placed by the nearest district outline (22 m).

### 2. Unit tests on the real data — 153 pass, 0 fail

`node --test tests/*.test.js` (Node 22): data, insight, views (incl. fee codes in words and currencies), pins, labels, scales, massing, building units, building join, camera, terrain, MapLibre guards, MVT, geometry, icons, shell (citymeter-shell 0.6.1 manifest), discovery and group, release (one cache tag `20261112-r1`, one product version 0.1.0, schema-valid handoff JSON, publication hygiene incl. the two private sheet addresses known only by SHA-256).

### 3. LDS and Location Intelligence parity — 124 ok, 0 failed

`node scripts/check-lds-parity.mjs --lds Landometer-Design-System-v0.9.7.md --li Location-Intelligence-Profile-for-LDS-v0.9.7.md`: base file SHA-256 `d3085cbc…96` (Project copy), profile SHA-256 `5d485604…3c` (fetched from the public LDS site, `normative/`), every shipped value equal (count and li.supply LUTs, anchors, scale versions, classes, theme roles, series, cues). `assets/theme.css`, `js/cues.js` and the scale constants are the same as CityMETER · School @793da70.

### 4. Rendered QA (build container)

Chromium (Playwright) with MapLibre 5.6.2 from the npm tarball (the same bytes as the pinned unpkg file); basemap tiles cannot be reached from the container, so every local render shows the partial notice “แผนที่ฐาน” — expected here, not on the live site.

- Desktop 1440 × 900 and phone 390 × 844, light and dark, Thai and English: overview (Aha, legend, province fills and labels), province, campus (Kasetsart Bang Khen, Khon Kaen), university, unit, station, charts, table, help.
- English harvest (`?lang=en`): every view, 30 campuses with faculties or fees (all sections open), 40 universities, 60 units, all 77 provinces, the units measure and 25 stations — `window.__citymeterI18n.missing` empty; no page error.
- Fixed during QA: fee lines showed the research codes (now words), three CNY lines showed ฿ (now “CNY 15,300”), a long published-area note sat in a chip (now under the sources), English years now ค.ศ.

### 5. Live

Pending at the time of this commit: GitHub Pages, `npm run verify:live`, and a walk of the live site in Chrome (building join, massing, x-ray and campus extents need the real basemap). Results are added here after publication.

### 6. Not verified

- Building join, massing, x-ray and faculty-building camera with real basemap tiles (container has none) — live walk.
- Screen readers beyond the accessible names the tests check.
- Browsers other than Chromium.
