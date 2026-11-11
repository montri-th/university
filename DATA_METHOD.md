# CityMETER · University — data and method

How `data/universities.json` and `data/campus.json` are built, what one row and one figure mean, and what the demo
never claims. Every number below is a snapshot of release 0.1.0 (built 2026-11-12 from the research master as the
owner exported it that day; the research team's checks run to 2026-11-10). The page computes everything from the data
at run time, so these are fixtures, not constants.

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

หน้าจอไม่มีคำเตือน (กติกาเดียวกับ CityMETER · Hotel ที่เจ้าของตั้งไว้ 1 พ.ย. 2569: “ไม่มี caveats เลย”) ทุกบรรทัดที่มาท้ายหน้ามีลิงก์ “วิธีนับ” มาที่นี่ ขอบเขตของตัวเลขอยู่ตรงนี้ที่เดียว

- **นักศึกษา** = จำนวนนักศึกษาตามแฟ้มนักศึกษาของ อว. ปีการศึกษา 2568 ภาค 2 (`univ_std_11_01_2568_2.csv`) ตามที่แฟ้มรวมไว้ต่อหน่วยรายงาน ไม่ใช่จำนวนคนที่อยู่ในวิทยาเขต จำนวนที่นั่ง อัตราการเข้าเรียน หรือขนาดตลาด ตัวเลขเป็นยอดที่แฟ้มรวมไว้ ไม่ได้ตรวจว่าเป็นจำนวนคนที่ไม่ซ้ำกัน
- **หน่วยรายงาน** = มหาวิทยาลัย วิทยาเขต หรือสถาบันที่แฟ้มรายงานแยกไว้ (303 หน่วย) เป็นเส้นทางการรายงาน ไม่ใช่สถานที่ หน่วยหนึ่งอาจรวมนักศึกษาของหลายพื้นที่
- **จังหวัด** = จังหวัดที่แฟ้มระบุให้หน่วยรายงานนั้น นักศึกษาของหน่วยทั้งหมดนับในจังหวัดนั้น ไม่แบ่งตามจุดหรือวิทยาเขต มหาวิทยาลัยรัฐไม่จำกัดรับ (รามคำแหง · สุโขทัยธรรมาธิราช) รายงานนักศึกษาทั้งหมดไว้ในจังหวัดของหน่วย แม้นักศึกษาเรียนทางไกลหรือที่ศูนย์ในจังหวัดอื่น หน้าแรกจึงมีแท่งเทียบ “ไม่นับมหาวิทยาลัยเปิด” · จังหวัดที่ไม่มีหน่วยรายงาน = 0 ในแฟ้มนี้ (ขอบไม่มีสี) ไม่ได้แปลว่าไม่มีการเรียนการสอนในจังหวัด
- **สัดส่วนของประเทศ** = นักศึกษา (หรือหน่วยรายงาน) ในจังหวัดที่เลือก ÷ ทั้งประเทศในตัวกรอง · **สัดส่วนของจังหวัด** (เมื่อเลือกจังหวัด) = ของมหาวิทยาลัยที่เลือก ÷ ทั้งจังหวัด
- **ประเภทสถาบัน** = จัดกลุ่มเพื่ออ่านแผนที่ จากประเภทสถาบันในแฟ้ม อว. (`16_ENROLMENT.institution_type_raw`): รัฐในกำกับ · รัฐ (จำกัดรับ) · รัฐ (ไม่จำกัดรับ) · ราชภัฏ · ราชมงคล · เอกชน · สถาบันและวิทยาลัยเอกชน · นอกสังกัด อว. ไม่ได้บอกคุณภาพหรืออันดับ
- **ระดับ** = คอลัมน์ระดับของแฟ้ม: ป.ตรี · ป.โท · ป.เอก · อื่น ๆ (ปวช. ปวส. ประกาศนียบัตรบัณฑิต ประกาศนียบัตรบัณฑิตชั้นสูง ประกาศนียบัตร และอนุปริญญา)
- **คณะของหน่วยรายงาน** = ป้ายคณะในแฟ้ม (`FAC_NAME`) พร้อมนักศึกษาชาย/หญิงตามแฟ้ม ป้ายเป็นของแฟ้ม ไม่ได้ยืนยันว่าเป็นหน่วยงานแยก
- **วิทยาเขต** (“แห่ง” บนแผนที่) = พื้นที่ของมหาวิทยาลัยที่ทีมวิจัยตรวจสำหรับเดโม (`29_DEMO_SITES`, 190 แห่ง) ไม่ใช่สำมะโนวิทยาเขตที่เปิดสอน และชื่อพื้นที่บางแห่งมาจาก OpenStreetMap
- **นักศึกษาตามหน่วยรายงาน** (บนหน้าวิทยาเขต) = นักศึกษาของหน่วยรายงานที่ผูกกับวิทยาเขตนั้น บอกชื่อหน่วยและวิธีผูก (ตรงกับรายชื่อนำร่อง · ชื่อตรงกับทะเบียน อว. 2566 ทุกตัวอักษร · ตรงเมื่อไม่นับช่องว่าง · ชื่อที่ระบุวิทยาเขต) ไม่ใช่จำนวนคนในพื้นที่นั้น วิทยาเขตที่ไม่มีหน่วยผูกไม่แสดงตัวเลขนักศึกษา (ไม่ใช่ 0)
- **กรอบราว N ไร่** = พื้นที่ของกรอบจาก OpenStreetMap ที่ทีมวิจัยจับคู่ (ตร.ม. ÷ 1,600) เป็นค่าประมาณ ไม่ใช่โฉนด แนวเขตตามกฎหมาย หรือเนื้อที่ทางการ · **เนื้อที่** = ตามที่มหาวิทยาลัยเผยแพร่ แสดงตามที่เขียนไว้
- **คณะในพื้นที่นี้** = คณะที่ทีมวิจัยระบุว่าอยู่ในพื้นที่นี้ (`39_FACULTY_SPATIAL_STATUS`) พร้อมรูปอาคาร พื้นที่ หรือจุดของคณะเมื่อมี · **อาคารของคณะ** = อาคารบนแผนที่ที่จุดภายในของรูปคณะตกอยู่ · **คณะในอาคารนี้** = คณะที่รูปของคณะตกในขอบอาคารนั้น ความสูง “สูงราว” เป็นค่าประมาณของชุดข้อมูลอาคาร
- **ค่าธรรมเนียมตามประกาศ** = บรรทัดค่าธรรมเนียมในประกาศของมหาวิทยาลัย (14 พื้นที่นำร่อง) ตามหลักสูตรและแผนที่ประกาศระบุ แต่ละบรรทัดมีภาค (ปกติ/พิเศษ/นานาชาติ ฯลฯ) ส่วนประกอบ ช่วงที่จ่าย (ต่อภาค ต่อปี ตลอดหลักสูตร) กลุ่มนักศึกษา และรุ่นที่รับเข้า ในสกุลเงินของประกาศ (บาท หรือ CNY ไม่แปลงค่า) ไม่ใช่ค่าใช้จ่ายทั้งปริญญา ระดับราคา หรือการเทียบระหว่างมหาวิทยาลัย และ “หลักสูตรในประกาศ” ไม่ได้ยืนยันว่าหลักสูตรนั้นเปิดรับในปีนี้
- **การรับรองคุณภาพ** = ตามที่หน่วยงานเผยแพร่ (กรอบ สถานะ ช่วงปี ผู้รับรอง ลิงก์) ไม่ใช่คะแนนหรืออันดับ
- **ทะเบียน 2566** (จุดสีเทา) = จุดในทะเบียนสถานศึกษาของ อว. ปีการศึกษา 2566 ที่ยังไม่มีพื้นที่ที่ทีมวิจัยตรวจ ไม่นับรวมและไม่มีนักศึกษา จุดที่อยู่นอกจังหวัดของระเบียนตัวเองไม่วาด
- **ใกล้รถไฟฟ้า / รัศมีสถานี** = ระยะตรงจากจุดอ้างอิงของสถานีที่เปิดแล้วใน CityMETER Transit (รอบสถานี 1 กม.) ไม่ใช่ระยะเดิน เวลาเดินทาง หรือเขตบริการ · **สถานีที่กำลังสร้าง** = โครงการ ยังไม่ใช่บริการ
- **ภูมิประเทศ** = พื้นดินรอบจุด (รัศมี 500 ม. ต้นไม้ 300 ม.) จาก SRTM 30 ม. และแผนที่ OSM ไม่ใช่การประเมินความเสี่ยง
- **โลโก้** = จากชุดโลโก้ของทีมวิจัย ใช้เพื่อระบุมหาวิทยาลัย แหล่งไม่ได้ระบุเงื่อนไขการนำไปใช้ซ้ำ

## 1. Sources

| Input | What it is | Published here? |
|---|---|---|
| Research master “CityMETER University & Faculty Thailand — Research Master 2026-10-31” | The research team's Google Sheet (registry `research.TH.university`), modified 2026-11-11 17:17 UTC; the owner's .xlsx export of the whole workbook was read on 2026-11-12 (SHA-256 `38661fa5…cf22`), every tab converted to CSV with exact cell values (`scripts/xlsx-to-csv.py`; 43 tabs, each tab's SHA-256 in `meta.tabs`). 22 tabs are read (`scripts/build-data.py#TABS`). | No: neither the sheet, its address, its export nor its cells. Only the fields below, per record. |
| MHESI student file 2568/2 | `https://info.mhesi.go.th/open_data/univ_std_11_01_2568_2.csv` (SHA-256 `2decc2b3…2922`, checked 2026-10-31), summed by the research team per reporting unit in `20_INSTITUTION_CONTEXTS` and per unit · faculty · level in `16_ENROLMENT`. | Students per unit, level, faculty and sex, as the file reports them. |
| MHESI institution roster 2566 | `https://data.mhesi.go.th/…/univ_uni_11_01_2566.xlsx` (SHA-256 `5d18193c…4582`, checked 2026-10-31), in `03_CAMPUS_ROSTER`. | Names, campus labels and candidate points. Not the official institution codes (UNIV_ID). |
| Universities' own pages | Official URLs, faculties, programme and fee announcements (`32_DEMO_OFFERINGS`, `33_DEMO_FEE_LINKS`), quality pages (`08_QUALITY`), published areas, as the research team recorded them with their public links. | Yes, with the link of each page. |
| OpenStreetMap | Campus extents and faculty buildings the research team matched (`30_DEMO_GEOMETRY`, ODbL). | Yes, the geometry, credited. |
| Logo package | `university-web-logos-2026-11-09.zip` (SHA-256 `4a7cdb90…70fa`), `LOGO_LIBRARY`; every file is checked against `logo_sha256` before it is copied. | 15 files, content-addressed (`assets/logos/<sha16>.<ext>`). |
| CityMETER · Transit | `montri-th/transit` `data/transit.json` (release transit-data-2026-10-31-r1, commit and SHA-256 in `meta.context.rail`). | Stations near the sites (id, names, lines, status, reference point). |
| CityMETER · Shopping Center | `montri-th/shoppingcenter` `data/venues.json` (commit and SHA-256 in `meta.context.retail`), linked by `RETAIL_VENUE_LINKS`. | 4 venue links (name and venue id). |
| Area index, provinces, buildings | `data/area-index.json`, `data/provinces.geojson`, `data/boundary-receipts.json`, `data/building-units/` copied byte for byte from `montri-th/school` @793da70 (there from CityMETER production base info with receipts, and from the CityMETER · Hotel building build); district outlines of that commit's `data/frames/` are read at build time only. | Yes (copies). |

## 2. Two grains, never added to each other

- **Unit** = a reporting institution context of the student file 2568/2 (`20_INSTITUTION_CONTEXTS`, 303 rows): the students as the source sums them, the province the source names for the unit, the institution type of `16_ENROLMENT`, the faculties and levels of `16_ENROLMENT` (each unit's faculties and levels add up to its students; `tests/data.test.js`). A unit is a reporting path, not a place.
- **Site** = a campus area the research team reviewed for the demo (`29_DEMO_SITES`, 190 rows; 188 with a point, 164 with an extent): a published or reviewed reference point, an approximate extent, faculty memberships, programmes and fees for the pilot campuses, the nearest stations.
- **Students are counted per unit and summed per province only.** A unit's students are never allocated to a site, a polygon, a building or a district (`30_DEMO_GEOMETRY.physical_student_allocation_allowed = FALSE`; `38_CAMPUS_SPATIAL_STATUS`: “ห้ามจัดสรรยอดนักศึกษาลง polygon”).
- A university (`01_UNIVERSITIES`, 170 shown: 156 with units, the others with sites or roster points only; 26 with neither are not shown) sums its units; the units of the latest period carry the `01_UNIVERSITIES` totals.

## 3. Province membership

The province the source names for the unit (`20_INSTITUTION_CONTEXTS`), mapped to the 77 production provinces of the area index. 68 provinces have at least one unit; 9 have none (บึงกาฬ · ชัยนาท · กำแพงเพชร · มุกดาหาร · แม่ฮ่องสอน · พังงา · สิงห์บุรี · สตูล · ตราด) and are measured zero. Nothing is re-assigned by a point or a name at runtime.

A site's เขต/อำเภอ (shown on its chip) is the district outline its point falls in, at build time (School @793da70 frames; a point outside every simplified outline takes the nearest outline within 3 km and is noted: 1 site, 22 m). The district is a label of the point, never a membership of students.

## 4. Site ↔ unit links

A site shows the students of at most one unit, and a unit is linked to at most one site (`tests/data.test.js`). 135 sites are linked (1,469,223 students of their units):

| Link | Count | Rule |
|---|---|---|
| `pilot` | 11 | `34_DEMO_ENROLMENT` links the unit to the pilot campus (period 2568/2) |
| `name` | 98 | `38_CAMPUS_SPATIAL_STATUS`: the unit's raw name equals the name of the 2566 roster site the research team reviewed into this site, letter for letter |
| `name-ws` | 25 | the same, equal once whitespace is ignored |
| `qualified` | 1 | a campus-qualified unit name matched to an official campus extent |

The source details of a site say which rule made its link (`js/model.js#LINKS`). Three linked sites have their point in another province than their unit's (`meta.checks.siteUnitProvinceConflicts`): the students stay in the unit's province.

## 5. Points, extents and faculty geometry

- **Point** of a site (`29_DEMO_SITES.coordinate_status`), shown in the source details: a reference point the university publishes · a 2566 roster point the research team checked against the OpenStreetMap extent · a point inside the extent · a building that carries the university's name · a point a university page links to. Two sites have no point (they count everywhere except as a pin).
- **Extents and faculty geometry** (`30_DEMO_GEOMETRY`, 388 features): `extent` 165, faculty `building` 137, `shared` building 13, faculty `area` 16, faculty `point` 57. Each feature carries an interior point (`pt`) computed at build time for the building join. Geometry stays on its own site (`tests/data.test.js`).
- **Roster points** (162): records of the 2566 roster with a candidate point inside Thailand that no reviewed site represents. 14 records whose point lies in another province than the record's own are not drawn (`meta.checks.rosterPointsNotDrawn`).

## 6. Faculties, programmes, fees, quality

- Faculty memberships (210) from `39_FACULTY_SPATIAL_STATUS`, with the faculty's kind as the source labels it and its geometry when the research team found one.
- Programmes (503) in the universities' fee announcements (`32_DEMO_OFFERINGS`) and their fee lines (627, `33_DEMO_FEE_LINKS`), for the 14 pilot areas of Kasetsart, Chulalongkorn, Khon Kaen and Prince of Songkla universities. Each line keeps its amount, currency (THB 624, CNY 3), period, track, component, student category, cohort, academic year, estimate label and public source; the page reads the codes in words (`js/model.js#FEE_WORDS`, `cohortWords`) and never sums, averages or compares lines. A line the source marks as a component already included in a total says so (“รวมอยู่ในยอดรวมแล้ว”).
- Quality observations (228, `08_QUALITY`): framework, programme or faculty, status, dates, authority, source link — verbatim.
- Fee coverage of a university (`26_FEE_COVERAGE`): how many fee lines the research team holds and from how many sources.

## 7. Context from the same registry (straight lines, build time)

- Rail: every station of CityMETER · Transit with a reference point; a site's nearest operating station within 2 km and its nearest station under construction (straight line between reference points; `tests/data.test.js` recomputes each distance). The station panel lists the sites within 1 km.
- Retail: the CityMETER Shopping Center venues the research team linked to a site (`RETAIL_VENUE_LINKS`), opened in that demo by venue id.

## 8. What the page computes

- Province totals of the measure under the filters (type, province, search); the national or provincial Aha (`js/area-insight.js`): at most three provinces (or universities in a province) with the most of the measure, never cutting through a tie and never every item that holds the measure; the share with numerator and denominator; the same share without the `open` type as a second bar; the provinces with no unit.
- Ranks, type and level bars, the province chart (in the map's colour), the university ranking — all from the same units.
- Sites near a site (≤ 3 km), other campuses of the university, sites round a station (≤ 1 km), the faculty buildings of a campus (the drawn buildings holding a faculty geometry's interior point).

## 9. Colour and categorical rules

- Students: `li.supply` of the Location Intelligence Profile for LDS 0.9.7; reporting units: the base `count` family. All 41 LUT samples by rank among the measured nonzero provinces; identical HEX on both themes; zero is an outline (EVID-05 `measured_zero`), never a level.
- Types: LDS series by stable id with the series shape cue (`js/cues.js`); no star.
- `npm run check:lds -- --lds <base> --li <profile>` compares every shipped value with both source files.

## 10. Map: symbols, names, terrain, buildings

One pin per site with a point, coloured by type; extents dashed; faculty buildings outlined in the open campus; roster points quiet grey, never clickable; stations quiet rings. Campus names in the middle of the view (≤ 9, phone ≤ 5). Buildings per area from the CityMETER · Hotel building units (CityMETER Building V4 or OpenStreetMap). Terrain from SRTM 30 m and OSM.

## 11. Not published

`meta.excludedFields`: 04_SOURCE_CROSSWALK, 05_REVIEW_QUEUE, 06_DATA_DICTIONARY, 07_FEES beyond the pilot fee links of 33, 09_HISTORY, 11_IDENTITIES, the programme tables 12–14, 15_RESEARCH_COVERAGE, staff tables 17/22, outcomes 18/25, 19_UNIT_PERIOD_STATS, 21_SOURCE_UNION, CMU tables 23/24, 27_FEE_RESEARCH_LOG, 35_DEMO_REVIEW, 99_ADMISSION_PLAN; review notes, next actions, identity statuses, raw source locators; internal Sheet / Drive URLs; the roster's official institution codes (UNIV_ID); canonical ids and source record numbers as fields.

## 12. Research follow-ups (reported, not patched in `data/`)

- 3 linked sites whose point lies in another province than their unit's (§4).
- 14 roster points in another province than their record's (§5).
- 2 sites without a point (`PILOT-KU-AFFILIATE-IRRIGATION-COLLEGE`, `PILOT-CMU-SAMUT-SAKHON`).
- 3 sites outside the building units (`meta.checks.sitesOutsideBuildingUnits`): their buildings come from the basemap.
- 2 rows of `31_DEMO_UNIT_SITES` without a campus site in the source; not shown.
- Universities, units, sites and faculties have no English names in the master: they stay Thai on English pages.

## 13. Rebuild

```sh
# 1. The owner's .xlsx export of the research master (internal, never committed) → one CSV per tab
python3 -I scripts/xlsx-to-csv.py <export.xlsx> <tabs-dir>
# 2. The dataset (stops when a tab does not match the export manifest or a reconciliation fails)
python3 -I scripts/build-data.py --tabs <tabs-dir> --xlsx <export.xlsx> \
  --logos <unzipped logo package> --logo-zip <university-web-logos-2026-11-09.zip> \
  --index data/area-index.json --frames <montri-th/school@793da70>/data/frames --units data/building-units \
  --transit <montri-th/transit checkout> --shopping <montri-th/shoppingcenter checkout> \
  --out data --assets assets
```

Rebuilt on 2026-11-12 from the same inputs, the three data files equalled the earlier build of that day apart from the sheet's address, which the build no longer writes, and the 15 logos were byte-identical; the shipped files are that rebuild. `scripts/xlsx-to-csv.py` reproduced the SHA-256 of all 43 tabs.
