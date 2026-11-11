/**
 * This demo's navigation on the shared header code: the titles of its controls and its pictogram subset. The
 * nav-7 glyphs and the help dialog are js/shell/navigation.js, the dataset picker js/shell/header.js
 * (citymeter-shell: edit those in every repository at once, js/shell/manifest.json).
 */
import {installNavigation, NAV_GLYPHS, NAV_ICON_CONTRACT} from './shell/navigation.js';
import {installHeader} from './shell/header.js';

export {NAV_GLYPHS, NAV_ICON_CONTRACT};

/**
 * Metric-tile pictograms (test exception approved by the owner 2026-10-22 for the Luxury Brands demo; the subset of
 * CityMETER · School 0.6.0, built from the same source font with scripts/build-pictogram-font.py and copied unchanged;
 * to be registered in LDS if it proves itself). Same family and axes as nav-7, a separate subset so the approved nav-7
 * bytes stay unchanged. Glyph → meaning in University: school (the mortarboard) = มหาวิทยาลัย · students (groups) =
 * นักศึกษา · aff (account_tree) = หน่วยรายงาน · classroom (meeting_room) = คณะ · level (stairs) = ระดับ ป.ตรี/โท/เอก ·
 * programme (menu_book) = หลักสูตร · fee (payments) = ค่าธรรมเนียม · quality (verified) = การรับรองคุณภาพ · area (map) =
 * จังหวัด/อำเภอ and the campus extent · province (location_city) = จังหวัด · segment (category) = ประเภทสถาบัน · maps
 * (location_on) = วิทยาเขตบนแผนที่ · rail (train) = สถานีราง · compare (compare_arrows) = การเทียบ · building (apartment)
 * = อาคาร · sea (waves) · elevation (landscape) · relief (height) · forest = the ground round a campus · rank · date ·
 * distance · construction · dataset for short copy. The school-only glyphs of the subset (teacher, history, closed,
 * learning, tutor, language, arts, child) are not used. No star glyph: it would read as a rating.
 */
export const PICTOGRAM_CONTRACT = Object.freeze({
  family: 'LDS Material Symbols Rounded Pictogram',
  file: 'assets/icons/material-pictogram-300.woff2', bytes: 4892,
  sha256: '0c18b9ac3583748ff54cc3f5370edf47b3c0331b92629a26d3a2748cc65ea060',
  manifest: 'assets/icons/material-pictogram-300.json',
  axes: Object.freeze({FILL: 0, wght: 300, GRAD: 0, opsz: 24}),
  glyphs: Object.freeze({area: '\uE55B', province: '\uE7F1', segment: '\uE72C', ai: '\uE65F', streetview: '\uE56E', maps: '\uE0C8', building: '\uEA40',
    school: '\uE80C', students: '\uF233', teacher: '\uEAF0', classroom: '\uEB4F', level: '\uF1A9', fee: '\uEF63', quality: '\uEF76',
    programme: '\uEA19', history: '\uE8E5', aff: '\uE97A', closed: '\uE615', rail: '\uE570', compare: '\uE915',
    sea: '\uE176', elevation: '\uE564', relief: '\uEA16', forest: '\uEA99',
    rank: '\uF20C', date: '\uE878', distance: '\uE41C', construction: '\uEA3C', dataset: '\uF20E',
    learning: '\uE666', tutor: '\uE745', language: '\uE8E2', arts: '\uE40A', child: '\uEB41'}),
  status: 'test exception to LDS nav-7 (owner 2026-10-22; action and building glyphs 2026-10-29; terrain glyphs 2026-11-01; rank, date, distance, construction and dataset glyphs 2026-11-01 for short copy; school glyphs 2026-11-05; learning glyphs 2026-11-06)',
  fallback: 'Text labels carry the meaning; pictograms stay hidden until the font has loaded.',
});
const TITLES = {
  'fit-map': 'ปรับแผนที่ให้เห็นสิ่งที่เลือกหรือจังหวัดที่โฟกัส',
  'country-map': 'ดูทั้งประเทศ ทุกจังหวัดเท่ากัน',
  'toggle-3d': 'สลับ 3 มิติ / 2 มิติ',
  'toggle-neighborhoods': 'แสดงหรือซ่อนสีและขอบจังหวัด',
  'close-mobile-panel': 'กลับไปแผนที่',
  'sheet-back': 'กลับไปหน้าก่อน',
  'mobile-panel': 'เปิดแผงข้อมูลและตัวกรอง',
  'open-help': 'เปิดวิธีใช้',
  'open-help-sheet': 'เปิดวิธีใช้',
  'toggle-insights': 'เปิดหรือย่อกราฟเปรียบเทียบ',
  'open-table': 'เปิดตารางหน่วยรายงานตามตัวกรอง',
  'toggle-table': 'ปิดตารางและกลับไปแผนที่',
  'search': 'ค้นหาชื่อมหาวิทยาลัย วิทยาเขต หน่วยรายงาน อำเภอ หรือจังหวัด',
  'type': 'กรองตามประเภทสถาบัน',
  'province': 'กรองตามจังหวัด',
  'prev-page': 'ดูหน้าก่อนหน้าของตาราง',
  'next-page': 'ดูหน้าถัดไปของตาราง',
  'tab-provinces': 'เปรียบเทียบนักศึกษาหรือหน่วยรายงานของแต่ละจังหวัด',
  'tab-types': 'เปรียบเทียบตามประเภทสถาบัน',
  'tab-unis': 'เปรียบเทียบมหาวิทยาลัย',
};

if (typeof document !== 'undefined') {
  installNavigation({titles: TITLES, pictogramProbe: PICTOGRAM_CONTRACT.glyphs.school});
  installHeader();
}
