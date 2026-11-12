# CityMETER University — verification

## Release 0.1.3 — 12 พ.ย. 2569

From the owner's walk of 0.1.2 (11:12, KMITL Ladkrabang and Chula): “กรอบมหาลัยโอเคนะ แต่ทำไมไม่แสดงอาคารทั้งหมดในกรอบเวลา highlight”, “และถ้ามีตำแหน่งคณะในแผนที่แล้วน่าจะโชว์ป้ายด้วย”, “apply ทุกมหาลัยได้มั้ย”.

- Buildings in the extent (`js/campus-buildings.js`, `DATA_METHOD.md` §10b): every campus with an extent (164 of 190 sites); `tests/campus-buildings.test.js` (inside, hole, outside, a building straddling the edge by its interior point, a tile-cut building lit whole). `js/massing.js` membership by `match` (`tests/massing.test.js` updated).
- Faculty labels (`js/faculty-labels.js`): every campus with a located faculty (24 sites, 178 faculties, 168 labels); `tests/faculty-labels.test.js` (place order, shared places, ranking, every placed faculty of every site on a label, Chula 20).
- Local: 168 tests pass; LDS parity 124 ok, 0 failed (base `d3085cbc…`, profile `5d485604…`). Chromium (Playwright; no basemap or building tiles in the container, so no lit buildings): Chula 1440 × 900 dark Thai 14 labels, light English 14, 390 × 844 dark 4; KMITL (`NATIONAL-MHESI2566-R000089`) 1440 light 4, 390 light English 3; no label over another or over a campus label, no missing English, no horizontal scroll.

## Release 0.1.2 — 12 พ.ย. 2569

From the owner's walk of 0.1.1 (07:31): “ทำไมจุฬามีคณะเดียว”, “อาคาร 3 มิติ นอกเขตมหาวิทยาลัยไม่แสดงเลย มันไม่เหมือนกับ demo ของ hotel เลย”, “ในต่างจังหวัดที่อาคาร 3d ของ OSM มีน้อยหรือไม่มี ไม่ได้เอา CityMETER มาเสริมให้”, and the same standard as citymeter.pages.dev; the Chula pilot approved at 07:56.

- Data: rebuilt from the export taken after the Chula pilot (`DATA_METHOD.md` §6a; SHA-256 `2ab7cda4…f017`). The new export differs from the old only in 10_SOURCES, 30, 31 and 39, and there only in the 76 status cells and the 39 appended rows written (checked cell by cell). Chulalongkorn (Pathumwan): 20 located faculties (1 before); geometry 407, memberships 229; logos byte-identical.
- Building units round the campuses (`DATA_METHOD.md` §10a): 44 อปท. added (43 CityMETER Building V4, 1 OSM), every unit file valid (`validUnitFile`), earlier slots unchanged; `meta.checks.sitesOutsideBuildingUnits` empty.
- Map focus (`js/regions.js`): campus surroundings and the camera square; `tests/regions.test.js` (3 tests).
- Campus panel: the linked unit's other faculties without a location (`tests/views.test.js`, all 190 sites: never placed and unplaced at once).
- Shell: citymeter-shell 0.6.1 over the family's released 0.6.0 (School @d644108); School's shell tests taken whole, with University in the English and Living lists.
- Local: 160 tests pass. Chromium (Playwright, no basemap in the container): the Chula campus in Thai and English at 1440 × 900 light and 390 × 844 dark — 20 faculties, 6 named without a location, smallest panel text 12 px, no missing English, no page error.
- Live, GitHub Pages: deployment of 3213c31 succeeded 2026-11-12 01:25 UTC; `npm run verify:live` 195 ok, 0 failed (every tracked public file equal to the repository's bytes). After 57f9299 (this file only, deployed 01:33 UTC): 194 ok, 1 failed — `handoff/VERIFICATION.md`, whose live bytes equal the commit's but which was edited after the local manifest (`npm run handoff:manifest`, `handoff/handoff-manifest.json`, not tracked) had been generated; the manifest is generated again for the commit that adds this record.
- Live, CityMETER Pages (`https://citymeter.pages.dev/university/`): University added to `montri-th/citymeter-pages-deploy` (3d397dc) and the demo hub (`montri-th/CityMETER` 9f0e3c7, 16 demos); release run 43135027348 (workflow_dispatch, publish on): 16 sources from their latest successful GitHub Pages deployments, each live index equal to its commit; 8,714 files assembled (release SHA-256 `9608f00f…e910`), 102 staged release files and 474 same-origin links checked, deployed, then 102 / 102 live checks passed (pages, `/release.json`, the versioned module path `/university/r/<digest>/js/app.js`, the policy headers, only `/r/` immutable).
- Live walk with the real basemap, the owner's Chrome (macOS, page 1710 × 871), 2026-11-12 08:40–09:00 ICT:
  - `https://citymeter.pages.dev/university/` starts from the versioned module (`/university/r/62398071dd38aaba/js/app.js?v=20261112-r3`); the hub's `/demos/demos.json` lists University (Living, th/en) among 16 demos.
  - Chula (`?site=PILOT-CHULA-MAIN`), dark and light, full budget: 10,361 buildings in 3D in and round the campus (4,630 OpenStreetMap, 5,731 CityMETER Building V4), the attribution names CityMETER Building V4; “คณะในพื้นที่นี้” lists 20 faculties and “คณะอื่นตามหน่วยรายงาน” 6 without a location; no console error.
  - Camera square: the camera eased about 3 km east (Lumphini); the focus followed it (44,234 buildings: 13,524 OpenStreetMap, 30,710 CityMETER).
  - Ubon Ratchathani University (`?site=NATIONAL-MHESI2566-R000092`), whose three อปท. hold at most 69, 410 and 15 OpenStreetMap buildings (bounding-box upper bounds) against 9,394, 8,273 and 9,252 CityMETER Building V4 (`DATA_METHOD.md` §10a): 13,501 buildings round the campus, all CityMETER Building V4.
  - Faculty building COM1 (Commerce and Accountancy): the two-point building view, “คณะในอาคารนี้” with the faculty by name, one provenance line.
  - GitHub Pages in English (`?site=PILOT-CHULA-MAIN&lang=en`): the same 10,361 buildings; “Faculties here” 20, “Other faculties of the reporting unit” 6 “not yet placed on the map”; `__citymeterI18n.missing` empty.
  - Phone budget (`?lean=phone`) in a 390 × 844 frame of the same origin, dark Thai and light English: the sheet over a flat plan view (the family's phone rule); at zoom 14.8, 2,637 buildings within 900 m of the camera (2,375 OpenStreetMap, 262 CityMETER) with the faculty buildings lit. The campus chip counts the faculty buildings among those drawn: 7 at the full budget, 6 at the phone's.
  - The test reset what it changed in that browser: the demo's theme setting back to `auto`; the `?lean` choice lives only in the closed test tab.
- Not verified: a real phone (touch, memory, a restart after the browser ends the page); browsers other than Chrome; screen readers beyond the accessible names the tests check.

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
