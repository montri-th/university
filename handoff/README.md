# CityMETER University — handoff

สำหรับนักพัฒนาที่รับงานต่อ เอกสารในโฟลเดอร์นี้มีสองรูปแบบที่ต้องตรงกัน: Markdown สำหรับคนอ่าน และ JSON (schema `handoff.schema.json` 1.5.0) สำหรับเครื่องตรวจ (`tests/release.test.js` ตรวจ schema และเลขรุ่น)

| ไฟล์ | อ่านเพื่อ |
|---|---|
| `../PRODUCT_STATEMENT.md` · `product-statement.json` | ผู้ใช้ ปัญหา คู่เทียบ กลยุทธ์ claim boundary และสมมติฐานที่ต้องทดสอบ |
| `PRODUCT_BRIEF.md` · `product-brief.json` | สัญญาของหน้าจอ: ข้อค้นพบแรก มาตรวัด สี สองระดับของข้อมูล วิทยาเขต คณะ ค่าธรรมเนียม แผง กราฟ กล้อง |
| `IMPLEMENTATION_PLAN.md` · `implementation-plan.json` | สถาปัตยกรรม โมดูล งาน acceptance criteria และ backlog |
| `VERIFICATION.md` | ผลตรวจของรุ่นนี้: tests, render, English harvest, live attestation, live walk |
| `../DATA_METHOD.md` | ที่มาของทุกตัวเลข วิธีผูกวิทยาเขตกับหน่วยรายงาน บริบท และสิ่งที่ไม่เผยแพร่ |
| `../AGENTS.md` | ความต้องการของเจ้าของที่เป็นสัญญา — อ่านก่อนแก้ |

## ลำดับการทำงาน

1. แก้ข้อมูลในชีตวิจัยเท่านั้น (ไม่ commit ชีต ไฟล์ส่งออก เซลล์ หรือที่อยู่ของชีต)
2. เจ้าของส่งออกชีตเป็น .xlsx แล้ว `python3 -I scripts/xlsx-to-csv.py <export.xlsx> <tabs-dir>`
3. `python3 -I scripts/build-data.py …` ตาม `DATA_METHOD.md` §13
4. `npm test` และ `npm run check:lds -- --lds <base> --li <profile>` และเดินหน้าเว็บแบบ `?lang=en` ทุกมุมมองให้ไม่มีข้อความไทยค้าง
5. ขยับ `?v=YYYYMMDD-rN` ใน `index.html` + `package.json` + `design-intent.json` + handoff JSON
6. push `main` → GitHub Pages → `npm run handoff:manifest` → `npm run verify:live`
7. เดินเว็บจริงที่ 1440 และ 390 px ทั้ง light และ dark ไทยและอังกฤษ ก่อนบอกว่าเสร็จ
8. อัปเดตแถว `research.TH.university` ใน CityMETER Dataset Registry (คอลัมน์ demo) ในชีตเดิม

## จุดที่ต้องระวัง

- นักศึกษาเป็นของหน่วยรายงาน นับในจังหวัดของหน่วย ห้ามแบ่งลงวิทยาเขต กรอบ อาคาร หรือเขต · วิทยาเขตแสดงตัวเลขของหน่วยที่ผูกพร้อมชื่อและวิธีผูก · วิทยาเขตที่ไม่มีหน่วยผูกไม่มีตัวเลข (ไม่ใช่ 0)
- มหาวิทยาลัยเปิด (`open`) รายงานนักศึกษาทั้งหมดในจังหวัดของหน่วย — ข้อค้นพบแรกจึงมีแท่งเทียบที่ไม่นับประเภทนี้
- ค่าธรรมเนียม = บรรทัดตามประกาศ ในสกุลเงินของประกาศ ห้ามรวม เฉลี่ย เทียบ หรือแปลงค่า · รหัสใหม่ต้องมีคำใน `js/model.js#FEE_WORDS` (test จะ fail)
- ไม่มีคำเตือนบนหน้าจอ ข้อจำกัดอยู่หลังลิงก์ “วิธีนับ” (DATA_METHOD.md)
- `js/shell/` เป็น citymeter-shell 0.6.1 (ไบต์เดียวกันทุก repo) อย่าแก้ที่นี่ที่เดียว · MapLibre ล็อกที่ 5.6.2 พร้อม `js/shell/maplibre-guard.js`
- ลำดับ layer มวลอาคาร x-ray สถานี กรอบวิทยาเขต และหมุด มีผลต่อมุมมองอาคาร อย่าสลับโดยไม่ทดสอบ
