import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLabelCandidates, shortName, labelParts, centreCandidates, placeLabels, LABEL_MIN_ZOOM, LABEL_MAX} from '../js/labels.js';

// The Hotel rule of 2026-11-01 (point 5): names near the middle of the view, most important first (the linked unit's
// students), short (icons before words), never covering the chrome or each other.
test('labels: importance first, then nearness to the centre; stable', () => {
  const c = [{row: {id: 'b', importance: 0.5}, d: 0.1}, {row: {id: 'a', importance: 0.9}, d: 0.9}, {row: {id: 'c', importance: 0.5}, d: 0.05}];
  assert.deepEqual(rankLabelCandidates(c).map(x => x.row.id), ['a', 'c', 'b']);
  assert.ok(LABEL_MIN_ZOOM >= 12 && LABEL_MAX.phone < LABEL_MAX.desktop);
});

test('short names drop the leading มหาวิทยาลัย/สถาบัน the cue already says and the research team’s note; the campus stays', () => {
  assert.equal(shortName({name: 'มหาวิทยาลัยเกษตรศาสตร์ บางเขน'}), 'เกษตรศาสตร์ บางเขน');
  assert.equal(shortName({name: 'มหาวิทยาลัยมหิดล — พื้นที่ศาลายา (ชื่อพื้นที่จาก OSM)'}), 'มหิดล — พื้นที่ศาลายา');
  assert.equal(shortName({name: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง'}), 'เทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง');
  assert.equal(shortName({name: 'จุฬาลงกรณ์มหาวิทยาลัย'}), 'จุฬาลงกรณ์มหาวิทยาลัย', 'a name that does not begin with the word stays whole');
  assert.equal(shortName({name: 'มหาวิทยาลัย'}), 'มหาวิทยาลัย', 'never shorter than 3 characters: the full name stays');
});

test('candidates come from the central ellipse only; placement avoids blockers and other labels and respects the cap', () => {
  const rows = Array.from({length: 30}, (_, i) => ({id: `h${i}`, longitude: i, latitude: 0, importance: 1 - i / 30}));
  const box = {left: 0, right: 1000, top: 0, bottom: 600};
  const project = ([x]) => ({x: 100 + x * 30, y: 300});
  const cands = centreCandidates(rows, project, box, {skip: 'h3'});
  assert.ok(cands.every(c => Math.abs(c.x - 500) <= 360) && !cands.some(c => c.row.id === 'h3'));
  const blockers = [{left: 380, right: 520, top: 0, bottom: 600}];
  const placed = placeLabels(rankLabelCandidates(cands), () => ({w: 80, h: 20}), () => 5, box, {max: 4, blockers});
  assert.ok(placed.length <= 4);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const p of placed) assert.ok(!blockers.some(b => overlaps(p.box, b)), 'never on the chrome');
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i].box, placed[j].box), 'never on another label');
});

test('label text: one short name, no figure (a site carries none of its own)', () => {
  assert.deepEqual(labelParts({name: 'มหาวิทยาลัยเชียงใหม่ — สวนดอก', unit: {students: 9000}}), {site: 'เชียงใหม่ — สวนดอก'});
});
