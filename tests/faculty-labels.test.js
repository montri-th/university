import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shortFacultyName, facultyPlace, facultyLabelRows, FACULTY_LABEL_MAX, FACULTY_LABEL_MIN_ZOOM} from '../js/faculty-labels.js';
import {decodeCampus} from '../js/campus.js';
import {facultiesOf} from '../js/profile-model.js';

const pt = (lon, lat) => ({role: 'point', g: {type: 'Point', coordinates: [lon, lat]}, pt: [lon, lat]});
const building = (lon, lat, role = 'building') => ({role, g: {type: 'Polygon', coordinates: []}, pt: [lon, lat]});
const area = (lon, lat) => ({role: 'area', g: {type: 'Polygon', coordinates: []}, pt: [lon, lat]});

test('shortFacultyName drops a leading คณะ only', () => {
  assert.equal(shortFacultyName('คณะวิศวกรรมศาสตร์'), 'วิศวกรรมศาสตร์');
  assert.equal(shortFacultyName('วิทยาลัยปิโตรเลียมและปิโตรเคมี'), 'วิทยาลัยปิโตรเลียมและปิโตรเคมี');
  assert.equal(shortFacultyName('สำนักวิชาทรัพยากรการเกษตร'), 'สำนักวิชาทรัพยากรการเกษตร');
  assert.equal(shortFacultyName('คณะ ก'), 'คณะ ก', 'never shorter than 3 characters');
});

test('facultyPlace: a reference point first, then a building or shared building, then an area; none → null', () => {
  assert.deepEqual(facultyPlace({geometry: [building(1, 1), pt(2, 2), area(3, 3)]}), [2, 2]);
  assert.deepEqual(facultyPlace({geometry: [area(3, 3), building(1, 1, 'shared')]}), [1, 1]);
  assert.deepEqual(facultyPlace({geometry: [area(3, 3)]}), [3, 3]);
  assert.equal(facultyPlace({geometry: []}), null);
  assert.equal(facultyPlace({geometry: [{role: 'extent', pt: [1, 1]}]}), null, 'a campus extent is not a faculty place');
});

test('facultyLabelRows: one label per place (first name + N), ranked by students then name; unplaced faculties left out', () => {
  const rows = facultyLabelRows([
    {name: 'คณะนิติศาสตร์', students: 2056, geometry: [pt(100.53, 13.73)]},
    {name: 'คณะวิศวกรรมศาสตร์', students: 6268, geometry: [pt(100.532, 13.736)]},
    {name: 'คณะพาณิชยศาสตร์และการบัญชี', students: 4515, geometry: [building(100.531, 13.734, 'shared')]},
    {name: 'คณะจิตวิทยา', students: 805, geometry: [building(100.531, 13.734, 'shared')]},
    {name: 'คณะไม่มีตำแหน่ง', students: 9999, geometry: []},
    {name: 'สถาบันไม่มีตัวเลข', students: null, geometry: [pt(100.54, 13.74)]},
  ]);
  assert.deepEqual(rows.map(r => r.short), ['วิศวกรรมศาสตร์', 'พาณิชยศาสตร์และการบัญชี', 'นิติศาสตร์', 'สถาบันไม่มีตัวเลข']);
  const shared = rows[1];
  assert.equal(shared.more, 1);
  assert.deepEqual(shared.names, ['คณะพาณิชยศาสตร์และการบัญชี', 'คณะจิตวิทยา']);
  assert.equal(rows[3].students, null, 'no figure is never 0');
  assert.ok(rows.every(r => r.id.startsWith('faculty:')));
});

test('every campus with a located faculty gets labels; Chulalongkorn (Pathumwan) labels its 20 placed faculties', () => {
  const campus = decodeCampus(JSON.parse(readFileSync(new URL('../data/campus.json', import.meta.url))));
  const sites = JSON.parse(readFileSync(new URL('../data/universities.json', import.meta.url))).sites;
  let withPlace = 0;
  for (const [siteIndex, list] of campus.faculties) {
    const faculties = facultiesOf({id: sites.key[siteIndex]}, siteIndex, campus);
    const placed = faculties.filter(f => facultyPlace(f));
    const rows = facultyLabelRows(faculties);
    assert.equal(rows.reduce((n, r) => n + 1 + r.more, 0), placed.length, `site ${sites.key[siteIndex]}: every placed faculty is on a label`);
    if (placed.length) withPlace++;
    assert.ok(list.length >= placed.length);
  }
  assert.ok(withPlace >= 20, `campuses with a placed faculty: ${withPlace}`);
  const chula = sites.key.indexOf('PILOT-CHULA-MAIN');
  const rows = facultyLabelRows(facultiesOf({id: 'PILOT-CHULA-MAIN'}, chula, campus));
  assert.equal(rows.reduce((n, r) => n + 1 + r.more, 0), 20);
  assert.ok(FACULTY_LABEL_MAX.desktop >= 20 && FACULTY_LABEL_MAX.phone < FACULTY_LABEL_MAX.desktop);
  assert.ok(FACULTY_LABEL_MIN_ZOOM <= 13);
});
