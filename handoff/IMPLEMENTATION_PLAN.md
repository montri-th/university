# CityMETER University — Implementation Plan (0.1.0)

คู่กับ `implementation-plan.json` (เครื่องตรวจ)

## สถาปัตยกรรม

Static site บน GitHub Pages — ES modules ผ่าน import map (ทุกโมดูลมี `?v=` เดียวกัน) ไม่มี build step · Node ≥ 20 สำหรับ tests · Python 3 สำหรับสร้างข้อมูล · MapLibre GL JS 5.6.2 จาก unpkg (ล็อก SRI) · tiles จาก OpenFreeMap

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ประสานทุกส่วน: scope ข้อค้นพบ แผง layer ไฟล์วิทยาเขต กล้องอาคาร URL แจ้งข้อมูลไม่ครบ |
| `js/model.js` | ถอด `data/universities.json` มาตรวัด ระดับ วิธีผูก ขนาดหมุด ตัวกรอง สรุป คำของรหัสค่าธรรมเนียม สกุลเงิน |
| `js/area-insight.js` | ข้อค้นพบแรก (จังหวัดหรือมหาวิทยาลัย กติกาค่าเท่ากัน แท่งเทียบมหาวิทยาลัยเปิด จังหวัดที่ไม่มีหน่วยรายงาน) |
| `js/provinces.js` | สีและขอบจังหวัด (41 ระดับ) เส้นโฟกัสและที่เลือก |
| `js/campus.js` | ถอด `data/campus.json` กรอบวิทยาเขต รูปคณะ และการกดบนกรอบ |
| `js/profile-model.js` | model ของ overview วิทยาเขต มหาวิทยาลัย หน่วยรายงาน สถานี อาคาร |
| `js/panel.js` · `js/charts.js` | แผงอ่าน (HTML) และกราฟ (HTML ไม่ใช้ไลบรารี) |
| `js/pins.js` · `js/labels.js` · `js/stations.js` | หมุด ชื่อกลางจอ สถานี |
| `js/massing.js` · `js/shell/*` | มวลอาคาร x-ray กล้อง ภูมิประเทศ หน่วยอาคาร header URL i18n (citymeter-shell 0.6.1) |
| `js/scales.js` · `js/cues.js` | สเกล li.supply และ count ครบ 41 ระดับ · ประเภท → series และรูปทรง |
| `js/lang.js` · `js/lang-en.js` | ภาษาอังกฤษ |

## งาน

T1 อ่านไฟล์ส่งออก (`scripts/xlsx-to-csv.py`) · T2 สร้างข้อมูล (`scripts/build-data.py`) · T3 model และข้อค้นพบ · T4 แผนที่ · T5 แผง กราฟ ตาราง · T6 ค่าธรรมเนียมเป็นคำและสกุลเงิน · T7 ภาษาอังกฤษ · T8 shell 0.6.1 · T9 เอกสาร handoff release · T10 เผยแพร่ ตรวจ live และอัปเดตทะเบียน (ดู `VERIFICATION.md`)

## Acceptance criteria

A1–A18 ใน `implementation-plan.json` — unit tests บนข้อมูลจริง (`tests/*.test.js`), LDS parity, English harvest และ live attestation

## Backlog

ชื่ออังกฤษของมหาวิทยาลัยในชีตวิจัย · แก้ 3 วิทยาเขตที่จังหวัดของจุดไม่ตรงกับหน่วย และ 14 จุดทะเบียนที่อยู่นอกจังหวัดของตัวเอง · เพิ่มพื้นที่นำร่องของคณะและค่าธรรมเนียม · demo อื่นรับ citymeter-shell 0.6.1 เพื่อให้เมนูชุดข้อมูลและหน้ารวมเดโมมี University · เงื่อนไขการใช้โลโก้ซ้ำ · รหัสชุดข้อมูลใน production
