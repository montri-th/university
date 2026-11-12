# CityMETER University — Developer Handoff

รุ่นเผยแพร่ 0.1.1 · 12 พ.ย. 2569 · ชีตวิจัยอ่านและสร้างข้อมูล 12 พ.ย. 2569 (ไฟล์ส่งออกของเจ้าของ) · ทีมวิจัยตรวจพื้นที่ถึง 10 พ.ย. 2569 · แฟ้มนักศึกษา อว. 2568/2

เริ่มอ่าน `source/handoff/README.md` จากนั้น Product Statement (`source/PRODUCT_STATEMENT.md` + `source/handoff/product-statement.json`), Product Brief และ Implementation Plan ในโฟลเดอร์ `source/handoff` ทั้ง `.md` และ `.json` ใช้คู่กัน

เข้าโฟลเดอร์ `source` แล้วรัน `npm test` และ `npm start` เปิด http://127.0.0.1:4173/ (English: `?lang=en`)

ชุดนี้มี source code (ES modules มีคอมเมนต์สัญญาทุกโมดูล ต่อยอดจาก CityMETER · School 0.6.0 หลัง Phase 0), datasets (ดัชนีจังหวัด + ขอบเขต 77 จังหวัด + หน่วยรายงาน นักศึกษา มหาวิทยาลัย วิทยาเขต กรอบพื้นที่ คณะ หลักสูตรและค่าธรรมเนียมตามประกาศ การรับรอง โลโก้ สถานี หน่วยอาคาร), assets ที่ตรวจ hash แล้ว, unit tests บนข้อมูลจริง, JSON Schema 1.5.0, acceptance criteria A1–A18, สคริปต์แปลงไฟล์ส่งออก/สร้างข้อมูล/manifest/bundle ตรวจ LDS + Location Intelligence parity และตรวจ live bytes อ่าน `source/AGENTS.md` ก่อนแก้ไข

เว็บจริง: https://montri-th.github.io/university/
Repository: https://github.com/montri-th/university

`RELEASE_RECEIPT.json` (ถ้ามีในชุด) ผูกชุดส่งต่อกับ commit ผล GitHub Pages และ live attestation ส่วน `evidence/` เป็นหลักฐานหน้าจอและผลเทียบ hash ของไฟล์บนเว็บ แยกจาก source ที่ commit แล้ว
