#!/usr/bin/env python3
"""Build data/universities.json and data/campus.json from the university research master.

Inputs (internal, never committed):
  --tabs     a directory of the research master's tabs, one CSV per tab with exact cell values, converted from the
             owner's .xlsx export of “CityMETER University & Faculty Thailand — Research Master 2026-10-31” (a Google
             Sheet of the research team, registry id research.TH.university; its address is not published). The export's
             SHA-256 and every tab's SHA-256 are recorded in meta.tabs (scripts/xlsx-to-csv.py writes manifest.json).
  --logos    the research team's logo package (university-web-logos-2026-11-09.zip, unzipped), every file checked
             against LOGO_LIBRARY.logo_sha256 before it is copied to assets/logos/.
Public inputs:
  --index    data/area-index.json (provinces and districts of CityMETER production; ids are production codes)
  --frames   district outlines (data/frames of montri-th/school @793da70; display geometry) — a site's เขต/อำเภอ by point
  --units    data/building-units (CityMETER Building V4 / OSM building units) — coverage check only
  --transit  a checkout of montri-th/transit (data/transit.json: rail stations of CityMETER · Transit)
  --shopping a checkout of montri-th/shoppingcenter (data/venues.json: CityMETER Shopping centers & retail venues)

Outputs: data/universities.json (first paint: units, universities, sites, roster points, stations), data/campus.json
(on demand: campus extents and faculty geometry, faculty memberships, programmes and fees of the pilot campuses),
data/build-report.json (counts and checks), assets/logos/.

TWO GRAINS, NEVER ADDED TO EACH OTHER (00_README of the sheet; DATA_METHOD.md §2)
  unit  = a reporting institution context of the MHESI student file, academic year 2568 semester 2
          (20_INSTITUTION_CONTEXTS, 303 rows): reported students as the source sums them, the province the source
          names for the unit, the institution type of 16_ENROLMENT. A unit is a reporting path, not a place.
  site  = a campus site the research team reviewed for the demo (29_DEMO_SITES, 190 rows): a published or reviewed
          reference point, an approximate extent (OpenStreetMap, never a legal boundary), faculty memberships.
STUDENTS are counted per unit and summed per province only (the unit's own province field). A unit's students are
never allocated to a site, a polygon, a building or a district (30_DEMO_GEOMETRY.physical_student_allocation_allowed =
FALSE; 38 “ห้ามจัดสรรยอดนักศึกษาลง polygon”). A site may show the students of the unit linked to it, named as the
unit's figure (“นักศึกษาตามหน่วยรายงาน …”):
  pilot   34_DEMO_ENROLMENT links the unit to the pilot campus (campus name and official directory)
  name    38_CAMPUS_SPATIAL_STATUS: the unit's raw name equals the name of the 2566 roster site the research team
          reviewed into this site (exact, or exact after whitespace) — a candidate link, said so in the source details
  qualified 38: a campus-qualified unit name matched to an official campus extent
ROSTER POINTS = 2566 MHESI campus roster records with a candidate coordinate inside Thailand that no demo site
represents (38 status historical_point_candidate_only): drawn quietly, never counted, never given students.

Never: a census of operating campuses, unique persons, people on a campus, a legal boundary, a rank of quality, a
comparable price. Not copied (meta.excludedFields): review queues, identities, crosswalks, raw source paths, internal
sheet / Drive URLs, staff tables, 07_FEES rows outside the pilot fee links, admission plans.
"""
import argparse, collections, csv, datetime, hashlib, json, math, os, re, shutil, sys, unicodedata

csv.field_size_limit(10 ** 9)
SHEET_TITLE = 'CityMETER University & Faculty Thailand — Research Master 2026-10-31'
PERIOD = ('2568', '2')
RAIL_MAX_M = 2000
TABS = ['00_README', '01_UNIVERSITIES', '02_ACADEMIC_UNITS', '03_CAMPUS_ROSTER', '08_QUALITY', '10_SOURCES',
        '16_ENROLMENT', '20_INSTITUTION_CONTEXTS', '26_FEE_COVERAGE', '28_DEMO_READINESS', '29_DEMO_SITES',
        '30_DEMO_GEOMETRY', '31_DEMO_UNIT_SITES', '32_DEMO_OFFERINGS', '33_DEMO_FEE_LINKS', '34_DEMO_ENROLMENT',
        '36_DEMO_FEE_CALCS', '37_NATIONAL_SPATIAL_STATUS', '38_CAMPUS_SPATIAL_STATUS', '39_FACULTY_SPATIAL_STATUS',
        'LOGO_LIBRARY', 'RETAIL_VENUE_LINKS']

# Institution groups (presentation) from the MHESI student file's institution type (16_ENROLMENT.institution_type_raw);
# the 2566 roster's types (03_CAMPUS_ROSTER.institution_type_raw) map to the same groups where they name the same kind.
TYPES = [
    ('autonomous', 'มหาวิทยาลัยรัฐในกำกับ', 'Autonomous public university'),
    ('public', 'มหาวิทยาลัยรัฐ (จำกัดรับ)', 'Public university (selective admission)'),
    ('open', 'มหาวิทยาลัยรัฐ (ไม่จำกัดรับ)', 'Open-admission public university'),
    ('rajabhat', 'มหาวิทยาลัยราชภัฏ', 'Rajabhat university'),
    ('rmut', 'มหาวิทยาลัยเทคโนโลยีราชมงคล', 'Rajamangala university of technology'),
    ('private', 'มหาวิทยาลัยเอกชน', 'Private university'),
    ('private_other', 'สถาบัน · วิทยาลัยเอกชน', 'Private institute or college'),
    ('outside', 'สถานศึกษานอกสังกัด อว.', 'Institution outside MHESI'),
]
TYPE_INDEX = {t[0]: i for i, t in enumerate(TYPES)}
UNIT_TYPE = {
    'มหาวิทยาลัยรัฐในกำกับ': 'autonomous', 'มหาวิทยาลัยรัฐจำกัดรับ': 'public', 'มหาวิทยาลัยรัฐไม่จำกัดรับ': 'open',
    'มหาวิทยาลัยราชภัฎ': 'rajabhat', 'มหาวิทยาลัยราชภัฏ': 'rajabhat', 'มหาวิทยาลัยเทคโนโลยีราชมงคล': 'rmut',
    'มหาวิทยาลัยเอกชน': 'private', 'สถาบันเอกชน': 'private_other', 'วิทยาลัยเอกชน': 'private_other',
    'สถานศึกษานอกสังกัดฯ': 'outside',
}
ROSTER_TYPE = {  # 2566 roster vocabulary; มหาวิทยาลัยของรัฐ is resolved by name (ราชภัฏ / ราชมงคล) or stays public
    'มหาวิทยาลัยในกำกับรัฐ': 'autonomous', 'มหาวิทยาลัยเอกชน': 'private', 'วิทยาลัยเอกชน': 'private_other',
    'สถาบันเอกชน': 'private_other', 'สถานศึกษานอกสังกัด อว.': 'outside',
}
# Levels of the student file (LEV_NAME_TH) → four columns; the rest are “other” and stay named in DATA_METHOD.md.
LEVELS = {'ป.ตรี': 'ba', 'ป.โท': 'ma', 'ป.เอก': 'phd'}
UNIT_KINDS = {  # 02_ACADEMIC_UNITS.unit_kind_hint → short label (the hint itself says the label is the source's)
    'faculty_label_not_independent_organization_verification': 'faculty', 'college_label': 'college',
    'school_of_label': 'school', 'graduate_school_label': 'graduate', 'institute_label': 'institute',
    'discipline_or_department_label': 'department', 'school_label': 'school',
    'placeholder_no_faculty_not_a_faculty': 'none', 'campus_label_in_FAC_NAME_not_confirmed_faculty': 'campus',
    'other_source_unit_label_requires_review': 'other',
}
# 29_DEMO_SITES.coordinate_status → what the point is (shown in the source details, never as a caveat line)
COORD_ROLE = [
    ('official', 'จุดอ้างอิงที่มหาวิทยาลัยเผยแพร่'),
    ('roster', 'จุดทะเบียน อว. ปี 2566 ที่ทีมวิจัยตรวจกับกรอบ OpenStreetMap'),
    ('extent', 'จุดในกรอบพื้นที่ OpenStreetMap'),
    ('building', 'จุดอาคารที่มีชื่อของมหาวิทยาลัย'),
    ('linked', 'จุดอ้างอิงที่หน้าเว็บของมหาวิทยาลัยเชื่อมไป'),
]
GEOM_ROLES = {  # 30_DEMO_GEOMETRY.feature_role → drawn as
    'campus_extent': 'extent', 'faculty_building_footprint': 'building', 'known_faculty_building_footprint': 'building',
    'faculty_building_roof_footprint': 'building', 'known_shared_building': 'shared', 'shared_building_footprint': 'shared',
    'known_shared_building_footprint': 'shared', 'faculty_associated_building': 'building', 'candidate_building': 'building',
    'education_centre_building_footprint': 'building', 'faculty_mapped_area': 'area', 'faculty_associated_official_map_area': 'area',
    'faculty_research_site_partial_extent': 'area', 'faculty_reference_point': 'point', 'campus_reference_point': 'point',
    'official_campus_reference_point': 'point', 'official_linked_building_reference_point': 'point',
    'official_linked_reference_point': 'point', 'known_faculty_location_point': 'point', 'official_faculty_reference_point': 'point',
}
DEGREE = {'bachelor': 'ba', 'master': 'ma', 'doctorate': 'phd', 'master_or_graduate_certificate': 'ma',
          'doctorate_or_higher_graduate_certificate': 'phd', 'graduate_diploma': 'grad', 'higher_graduate_diploma': 'grad',
          'graduate_unspecified': 'grad'}
EXCLUDED = ['04_SOURCE_CROSSWALK', '05_REVIEW_QUEUE', '06_DATA_DICTIONARY', '07_FEES (beyond the pilot fee links of 33)',
            '09_HISTORY', '11_IDENTITIES', '12–14 programme tables', '15_RESEARCH_COVERAGE', '17/22 staff tables',
            '18/25 outcomes', '19_UNIT_PERIOD_STATS', '21_SOURCE_UNION', '23/24 CMU tables', '27_FEE_RESEARCH_LOG',
            '35_DEMO_REVIEW', '99_ADMISSION_PLAN', 'review notes, next actions, identity statuses, raw source locators',
            'internal sheet / Drive URLs', 'official institution codes of the MHESI roster (UNIV_ID)', 'canonical ids, source record numbers as fields']


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_tabs(d):
    manifest = json.load(open(os.path.join(d, 'manifest.json'), encoding='utf-8'))
    shas = {s['title']: s for s in manifest['sheets']}
    out, meta = {}, {}
    for t in TABS:
        path = os.path.join(d, t + '.csv')
        if sha256_file(path) != shas[t]['csv_sha256']:
            sys.exit(f'{t}: CSV does not match the export manifest')
        rows = list(csv.reader(open(path, encoding='utf-8')))
        head = [h.strip() for h in rows[0]]
        if len(set(head)) != len(head):
            sys.exit(f'{t}: duplicate header')
        width = len(head)
        body = []
        for r in rows[1:]:
            if len(r) > width and any(c.strip() for c in r[width:]):
                sys.exit(f'{t}: a row has cells beyond the header')
            body.append(dict(zip(head, (r + [''] * width)[:width])))
        out[t] = body
        meta[t] = {'rows': len(body), 'columns': width, 'sha256': shas[t]['csv_sha256']}
    return out, meta, manifest


def clean(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ')).strip()


def th_key(s):
    return re.sub(r'\s+', '', unicodedata.normalize('NFC', str(s or '')).replace('ํา', 'ำ'))


def whole(v):
    v = str(v or '').replace(',', '').strip()
    if not v:
        return None
    if not re.fullmatch(r'-?\d+(\.0+)?', v):
        sys.exit(f'whole number expected, got {v!r}')
    return int(float(v))


def amount(v):
    v = str(v or '').replace(',', '').strip()
    return round(float(v), 2) if re.fullmatch(r'-?\d+(\.\d+)?', v) else None


def num(v):
    v = str(v or '').strip()
    return float(v) if re.fullmatch(r'-?\d+(\.\d+)?', v) else None


def jlist(v):
    v = (v or '').strip()
    if not v:
        return []
    x = json.loads(v)
    return x if isinstance(x, list) else []


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def ring_contains(ring, x, y):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def polys_of(g):
    return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []


def in_polys(polys, x, y):
    return any(ring_contains(p[0], x, y) and not any(ring_contains(h, x, y) for h in p[1:]) for p in polys)


def interior_point(g):
    """A point inside the largest ring of a polygon: the ring's centroid when it falls inside, else the midpoint of the
    widest horizontal span through the centroid's latitude (deterministic; display only)."""
    polys = polys_of(g)
    best, best_a = None, -1
    for p in polys:
        ring = p[0]
        a = 0.0
        cx = cy = 0.0
        for i in range(len(ring) - 1):
            x0, y0 = ring[i][0], ring[i][1]
            x1, y1 = ring[i + 1][0], ring[i + 1][1]
            c = x0 * y1 - x1 * y0
            a += c
            cx += (x0 + x1) * c
            cy += (y0 + y1) * c
        if abs(a) > best_a:
            best_a, best = abs(a), (p, cx / (3 * a) if a else ring[0][0], cy / (3 * a) if a else ring[0][1])
    if not best:
        return None
    p, x, y = best
    if in_polys([p], x, y):
        return round(y, 6), round(x, 6)
    xs = []
    ring = p[0]
    for i in range(len(ring) - 1):
        (x0, y0), (x1, y1) = ring[i][:2], ring[i + 1][:2]
        if (y0 > y) != (y1 > y):
            xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
    xs.sort()
    spans = [(xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2) for i in range(0, len(xs) - 1, 2)]
    if not spans:
        return round(ring[0][1], 6), round(ring[0][0], 6)
    return round(y, 6), round(max(spans)[1], 6)


class Districts:
    """เขต/อำเภอ outlines of the area index's frames (display geometry): the district a point falls in."""
    def __init__(self, frames_dir, provinces):
        self.items = []
        for code in provinces:
            frame = json.load(open(os.path.join(frames_dir, f'{code}.json'), encoding='utf-8'))
            for f in frame['areas']['features']:
                polys = polys_of(f['geometry'])
                xs = [p[0] for poly in polys for p in poly[0]]
                ys = [p[1] for poly in polys for p in poly[0]]
                self.items.append((str(f['id']), code, polys, min(xs), min(ys), max(xs), max(ys)))

    def find(self, lon, lat, near_m=3000):
        """(province, district, how): inside an outline, or else the nearest outline within near_m (display outlines are
        simplified, so a coastal point can fall just outside them)."""
        for did, code, polys, w, s, e, n in self.items:
            if w <= lon <= e and s <= lat <= n and in_polys(polys, lon, lat):
                return code, did, 'inside'
        kx = 111320 * math.cos(math.radians(lat))
        ky = 110540
        best, bd = None, near_m
        pad = near_m / ky + 0.01
        for did, code, polys, w, s, e, n in self.items:
            if not (w - pad <= lon <= e + pad and s - pad <= lat <= n + pad):
                continue
            for poly in polys:
                for ring in poly:
                    for i in range(len(ring) - 1):
                        ax, ay = (ring[i][0] - lon) * kx, (ring[i][1] - lat) * ky
                        bx, by = (ring[i + 1][0] - lon) * kx, (ring[i + 1][1] - lat) * ky
                        dx, dy = bx - ax, by - ay
                        t = max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) if dx or dy else 0.0
                        d = math.hypot(ax + t * dx, ay + t * dy)
                        if d < bd:
                            best, bd = (code, did), d
        return (best[0], best[1], f'nearest {round(bd)} m') if best else (None, None, '')


def public_url(u):
    u = (u or '').strip().split('\n')[0].strip()
    if not u.startswith('https://') and not u.startswith('http://'):
        return ''
    if re.search(r'docs\.google\.com|drive\.google\.com|localhost|\.local/|/Users/|file:', u):
        return ''
    return u


def repo_commit(path):
    head = open(os.path.join(path, '.git', 'HEAD')).read().strip()
    if head.startswith('ref:'):
        ref = head.split(' ', 1)[1]
        p = os.path.join(path, '.git', ref)
        if os.path.exists(p):
            return open(p).read().strip()
        for line in open(os.path.join(path, '.git', 'packed-refs')):
            if line.strip().endswith(ref):
                return line.split()[0]
    return head


def iso(d):
    d = (d or '').strip()
    m = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2}).*', d)
    if m:
        return f'{m[1]}-{m[2]}-{m[3]}'
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', d)
    return f'{int(m[3]):04d}-{int(m[1]):02d}-{int(m[2]):02d}' if m else ''


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tabs', required=True)
    ap.add_argument('--xlsx', required=True, help='the owner’s .xlsx export the tabs were converted from (hash only)')
    ap.add_argument('--logos', required=True)
    ap.add_argument('--logo-zip', required=True)
    ap.add_argument('--index', required=True)
    ap.add_argument('--frames', required=True)
    ap.add_argument('--frames-ref', default='montri-th/school@793da70 data/frames')
    ap.add_argument('--units', required=True)
    ap.add_argument('--transit', required=True)
    ap.add_argument('--shopping', required=True)
    ap.add_argument('--read-on', default='2026-11-12')
    ap.add_argument('--sheet-modified', default='2026-11-11T17:17:26.638Z')
    ap.add_argument('--out', required=True)
    ap.add_argument('--assets', required=True)
    a = ap.parse_args()

    tabs, tab_meta, manifest = read_tabs(a.tabs)
    report = {'checks': {}, 'counts': {}, 'notes': []}
    checks = report['checks']

    # ---------- gazetteer ----------
    index = json.load(open(a.index, encoding='utf-8'))
    prov_by_name = {th_key(p['name']): p['id'] for p in index['provinces']}
    prov_codes = [p['id'] for p in index['provinces']]
    districts = Districts(a.frames, prov_codes)
    area_name = dict(zip(index['areas']['id'], index['areas']['name']))

    def province_of(name):
        code = prov_by_name.get(th_key(name))
        if not code:
            sys.exit(f'province name {name!r} is not a production province')
        return code

    # ---------- units (20 + 16 + 02) ----------
    ctx_rows = tabs['20_INSTITUTION_CONTEXTS']
    if {(r['academic_year_be'], r['semester']) for r in ctx_rows} != {PERIOD}:
        sys.exit('20_INSTITUTION_CONTEXTS: a period other than 2568/2')
    unit_type, levels, sexes = {}, collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
    for r in tabs['16_ENROLMENT']:
        cid = r['institution_context_id']
        t = UNIT_TYPE.get(clean(r['institution_type_raw']))
        if not t:
            sys.exit(f'16_ENROLMENT: unknown institution type {r["institution_type_raw"]!r}')
        if unit_type.setdefault(cid, t) != t:
            sys.exit(f'16_ENROLMENT: {cid} has two institution types')
        n = whole(r['reported_student_count']) or 0
        levels[cid][LEVELS.get(clean(r['level_label_raw']), 'other')] += n
        sexes[cid][clean(r['sex_label_raw'])] += n
    unis_by_ref = {r['university_reference_id']: r for r in tabs['01_UNIVERSITIES']}
    faculties_by_ctx = collections.defaultdict(list)
    unit_ctx_students = {}
    for r in tabs['02_ACADEMIC_UNITS']:
        if r['latest_period_present'] != 'TRUE':
            continue
        ids = jlist(r['latest_institution_context_ids'])
        if len(ids) != 1:
            sys.exit('02_ACADEMIC_UNITS: a latest academic unit with no or several institution contexts')
        st = whole(r['reported_student_sum']) or 0
        unit_ctx_students[r['academic_unit_context_id']] = st
        # The academic unit's context id rides along (7th) only to place the site faculties below; never written.
        faculties_by_ctx[ids[0]].append([clean(r['academic_unit_name']), st, whole(r['reported_male_sum']) or 0,
                                         whole(r['reported_female_sum']) or 0, whole(r['programme_level_context_count']) or 0,
                                         UNIT_KINDS.get(r['unit_kind_hint'], 'other'), r['academic_unit_context_id']])
    units = []
    faculty_place = {}  # academic unit context id → (unit key, index in that unit's faculty list as written)
    for r in ctx_rows:
        cid = r['institution_context_id']
        st, m, f = whole(r['reported_student_sum']), whole(r['reported_male_sum']), whole(r['reported_female_sum'])
        if st is None or st <= 0:
            sys.exit(f'{cid}: no reported students')
        lv = levels[cid]
        if sum(lv.values()) != st:
            sys.exit(f'{cid}: level sums {sum(lv.values())} ≠ unit total {st}')
        fac = sorted(faculties_by_ctx[cid], key=lambda x: (-x[1], x[0]))
        if sum(x[1] for x in fac) != st:
            sys.exit(f'{cid}: faculty sums ≠ unit total')
        for i, x in enumerate(fac):
            faculty_place[x[6]] = (cid, i)
        fac = [x[:6] for x in fac]
        units.append({
            'key': cid, 'name': clean(r['institution_name_raw']), 'master': clean(r['institution_master_name_raw']),
            'uni': r['university_reference_id'], 'province': province_of(r['institution_province_raw']),
            'type': unit_type.get(cid) or sys.exit(f'{cid}: no institution type'), 'students': st, 'male': m or 0, 'female': f or 0,
            'ba': lv['ba'], 'ma': lv['ma'], 'phd': lv['phd'], 'other': lv['other'], 'faculties': fac,
            'programmes': whole(r['programme_level_context_count']) or 0,
        })
    units.sort(key=lambda u: (-u['students'], u['name']))
    unit_idx = {u['key']: i for i, u in enumerate(units)}
    total = sum(u['students'] for u in units)
    checks['unitsStudents'] = total
    if total != sum(whole(r['reported_student_sum']) or 0 for r in tabs['01_UNIVERSITIES']):
        sys.exit('units do not add up to 01_UNIVERSITIES')

    # ---------- universities ----------
    roster = tabs['03_CAMPUS_ROSTER']
    roster_by_rec = {int(r['source_record_number']): r for r in roster}

    def roster_type(r):
        t = clean(r['institution_type_raw'])
        if t in ROSTER_TYPE:
            return ROSTER_TYPE[t]
        name = clean(r['institution_name_raw'])
        return 'rajabhat' if 'ราชภัฏ' in name else 'rmut' if 'ราชมงคล' in name else 'public'

    uni_types = collections.defaultdict(set)
    for u in units:
        uni_types[u['uni']].add(u['type'])
    unis = []
    for r in tabs['01_UNIVERSITIES']:
        ref = r['university_reference_id']
        name = clean(r['university_name'])
        if not name:
            continue  # the unresolved blank master label (00_README): not a named university
        ts = uni_types.get(ref, set())
        if len(ts) > 1:
            sys.exit(f'{ref}: units of several types')
        unis.append({'key': ref, 'name': name, 'type': next(iter(ts)) if ts else '', 'students': whole(r['reported_student_sum']) or 0,
                     'latest': r['latest_period_present'] == 'TRUE', 'feeObs': whole(r['fee_observations_university_scope']) or 0,
                     'qualityObs': whole(r['quality_observations_university_scope']) or 0})
    uni_idx = {u['key']: i for i, u in enumerate(unis)}
    for u in units:
        if u['uni'] not in uni_idx:
            sys.exit(f'{u["key"]}: unit of an unnamed university')
    # a university without units in 2568/2 takes its type from the 2566 roster rows of its name (38 links them)
    roster_uni = collections.defaultdict(set)
    for r in tabs['38_CAMPUS_SPATIAL_STATUS']:
        if r['spatial_scope_id'].startswith('SPATIAL-MHESI2566-R'):
            rec = roster_by_rec[int(r['spatial_scope_id'].rsplit('R', 1)[1])]
            for ref in jlist(r['university_reference_ids_json']):
                roster_uni[ref].add(roster_type(rec))
    for u in unis:
        if not u['type']:
            ts = roster_uni.get(u['key'], set())
            u['type'] = next(iter(ts)) if len(ts) == 1 else ''
            u['typeFrom'] = 'roster2566' if u['type'] else ''
    checks['universitiesWithoutType'] = [u['name'] for u in unis if not u['type']]

    # ---------- logos ----------
    logo_rows = tabs['LOGO_LIBRARY']
    os.makedirs(os.path.join(a.assets, 'logos'), exist_ok=True)
    logos = {}
    for r in logo_rows:
        src = os.path.join(a.logos, r['logo_filename'])
        if sha256_file(src) != r['logo_sha256']:
            sys.exit(f'logo {r["logo_filename"]}: SHA-256 differs from LOGO_LIBRARY')
        ext = os.path.splitext(src)[1].lower()
        name = f'{r["logo_sha256"][:16]}{ext}'
        shutil.copyfile(src, os.path.join(a.assets, 'logos', name))
        logos[r['entity_id']] = {'file': f'assets/logos/{name}', 'sha256': r['logo_sha256'], 'surface': r['recommended_surface'],
                                 'w': num(r['width']), 'h': num(r['height']), 'page': public_url(r['logo_source_url']),
                                 'checked': iso(r['logo_checked_on'])}
    for u in unis:
        u['logo'] = logos.get(u['key'])
    checks['logos'] = len(logos)

    # ---------- transit (CityMETER · Transit) ----------
    transit_path = os.path.join(a.transit, 'data', 'transit.json')
    transit = json.load(open(transit_path, encoding='utf-8'))
    tlines = {l['id']: l for l in transit['lines']}
    stations = []
    for s in transit['stations']:
        if not (isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float))):
            continue
        if s.get('status') not in ('operating', 'construction'):
            continue
        stations.append({'id': s['id'], 'name': s['name'], 'nameEn': s.get('nameEn') or '', 'lat': s['lat'], 'lon': s['lng'],
                         'status': s['status'], 'lines': [tlines[l]['short'] or tlines[l]['name'] for l in s.get('lineIds', []) if l in tlines],
                         'lineIds': s.get('lineIds', [])})
    stations.sort(key=lambda s: s['id'])

    def nearest(lat, lon, status):
        best, bd = None, RAIL_MAX_M + 1
        for i, s in enumerate(stations):
            if s['status'] != status:
                continue
            d = haversine(lat, lon, s['lat'], s['lon'])
            if d < bd:
                best, bd = i, d
        return (best, round(bd)) if best is not None else (-1, None)

    # ---------- shopping venues (CityMETER Shopping centers) ----------
    shop_path = os.path.join(a.shopping, 'data', 'venues.json')
    venues = {v['id']: v for v in json.load(open(shop_path, encoding='utf-8'))['rows']}

    # ---------- sites (29) ----------
    site_rows = tabs['29_DEMO_SITES']
    geoms = {r['geometry_id']: r for r in tabs['30_DEMO_GEOMETRY']}
    hist_by_site = collections.defaultdict(list)  # site → 2566 roster record numbers the research team matched to it
    ctx_link = {}
    for r in tabs['38_CAMPUS_SPATIAL_STATUS']:
        sid = r['spatial_scope_id']
        if sid.startswith('SPATIAL-MHESI2566-R'):
            for s in jlist(r['matched_campus_site_ids_json']):
                hist_by_site[s].append(int(sid.rsplit('R', 1)[1]))
        elif sid.startswith('SPATIAL-INSTCTX-'):
            m = r['identity_link_method']
            kind = 'name' if m.startswith('exact_raw_name') else 'name-ws' if m.startswith('whitespace_only') else 'qualified' if m.startswith('campus-qualified') else ''
            for s in jlist(r['matched_campus_site_ids_json']):
                if kind:
                    ctx_link.setdefault(sid[len('SPATIAL-'):], []).append((s, kind))
    pilot_link = {}
    for r in tabs['34_DEMO_ENROLMENT']:
        if r['campus_site_id'] and r['institution_context_id'] and not r['academic_unit_context_id']:
            if r['physical_allocation_allowed'] != 'FALSE':
                sys.exit('34_DEMO_ENROLMENT: a physical allocation the build does not support')
            pilot_link[r['campus_site_id']] = (r['institution_context_id'], (r['academic_year_be'], r['semester']))
    site_unit = {}
    for cid, links in ctx_link.items():
        for s, kind in links:
            if s in site_unit and site_unit[s][0] != cid:
                sys.exit(f'{s}: two units link to one site')
            site_unit[s] = (cid, kind)
    for s, (cid, period) in pilot_link.items():
        if period != PERIOD:
            continue
        if s in site_unit and site_unit[s][0] != cid:
            sys.exit(f'{s}: 34 and 38 link different units')
        site_unit[s] = (cid, 'pilot')

    def coord_role(status):
        s = status
        if s.startswith('official_published') or s.startswith('official_named'):
            return 'official'
        if s.startswith('historical_MHESI2566') or s.startswith('historical_official'):
            return 'roster'
        if s.startswith('derived_interior') or s.startswith('use_osm_geometry'):
            return 'extent'
        if s.startswith('named_faculty_building'):
            return 'building'
        if s.startswith('officially_linked') or s.startswith('official_linked'):
            return 'linked'
        return ''

    sites, site_points = [], 0
    conflicts = []
    for r in site_rows:
        sid = r['campus_site_id']
        lat, lon = num(r['latitude']), num(r['longitude'])
        role = coord_role(r['coordinate_status'])
        ext = geoms.get(r['campus_geometry_id'])
        extent_ok = bool(ext and ext['selection_status'].startswith('selected') and ext['geometry_type'] in ('Polygon', 'MultiPolygon'))
        if 'do_not_plot' in r['coordinate_status']:
            lat = lon = None  # the roster coordinate conflicts with the reviewed extent (29.coordinate_status)
        if lat is None and extent_ok:  # no usable point: a point inside the reviewed extent, for the map only
            lat, lon = interior_point(json.loads(ext['geojson_geometry']))
            role = 'extent'
        if lat is not None and not role:
            sys.exit(f'{sid}: unknown coordinate status {r["coordinate_status"]!r}')
        prov = dist = None
        how = ''
        if lat is not None:
            site_points += 1
            prov, dist, how = districts.find(lon, lat)
            if not prov:
                sys.exit(f'{sid}: point more than 3 km outside every district')
            if how != 'inside':
                report['notes'].append(f'{sid}: district by the {how} outline (point outside the simplified outlines)')
        uref = r['university_reference_id']
        if uref not in uni_idx:
            sys.exit(f'{sid}: university {uref} is not a named university')
        link = site_unit.get(sid)
        unit = units[unit_idx[link[0]]] if link else None
        if unit and prov and unit['province'] != prov:
            conflicts.append({'site': sid, 'pointProvince': prov, 'unitProvince': unit['province']})
        t = unit['type'] if unit else unis[uni_idx[uref]]['type']
        hist = [roster_by_rec[n] for n in sorted(set(hist_by_site.get(sid, [])))]
        sites.append({
            'key': sid, 'name': clean(r['site_name_th']), 'uni': uni_idx[uref], 'type': t, 'kind': clean(r['site_kind']),
            'lat': lat, 'lon': lon, 'coord': role, 'province': prov or '', 'district': dist or '',
            'extent': r['campus_geometry_id'] if extent_ok else '', 'address': clean(r['address']),
            'officialArea': clean(r['official_area_label']), 'officialUrl': public_url(r['official_source_url']),
            'checked': iso(r['checked_on']), 'unit': unit_idx[link[0]] if link else -1, 'link': link[1] if link else '',
            # the 2566 roster records the research team reviewed into this site: name and campus kind only (the
            # roster's official institution codes are not copied, meta.excludedFields)
            'roster': [{'name': clean(h['institution_name_raw']), 'campus': clean(h['campus_type_raw'])} for h in hist],
            'pilot': sid.startswith('PILOT-'),
        })
    # a site without a point keeps its province from its unit or its roster records
    for s in sites:
        if not s['province']:
            if s['unit'] >= 0:
                s['province'] = units[s['unit']]['province']
            elif s['roster']:
                s['province'] = province_of(roster_by_rec[next(n for n in hist_by_site[s['key']])]['province_raw'])
    checks['siteUnitProvinceConflicts'] = conflicts
    checks['sitesWithoutPoint'] = [s['key'] for s in sites if s['lat'] is None]
    checks['sitesWithoutProvince'] = [s['key'] for s in sites if not s['province']]

    # rail and retail per site
    retail = collections.defaultdict(list)
    for r in tabs['RETAIL_VENUE_LINKS']:
        v = venues.get(r['shopping_venue_id'])
        if not v:
            sys.exit(f'RETAIL_VENUE_LINKS: venue {r["shopping_venue_id"]} is not in CityMETER Shopping centers')
        rec = [h for h in roster if h['official_univ_id'] == r['source_record_id']]
        if len(rec) != 1:
            sys.exit(f'RETAIL_VENUE_LINKS: roster record {r["source_record_id"]} not unique')
        recno = int(rec[0]['source_record_number'])
        hits = [s for s in sites if recno in hist_by_site.get(s['key'], [])]
        for s in hits:
            retail[s['key']].append({'venue': v['id'], 'name': v.get('name') or '', 'nameEn': v.get('nameEn') or '',
                                     'rel': r['relationship_type'], 'evidence': public_url(r['evidence_url']), 'checked': iso(r['checked_on'])})
        if not hits:
            report['notes'].append(f'retail link {r["shopping_venue_id"]}: roster record {r["source_record_id"]} has no demo site')
    for s in sites:
        if s['lat'] is not None:
            s['rail'], s['railM'] = nearest(s['lat'], s['lon'], 'operating')
            s['rail2'], s['rail2M'] = nearest(s['lat'], s['lon'], 'construction')
        else:
            s['rail'] = s['rail2'] = -1
            s['railM'] = s['rail2M'] = None
        s['retail'] = retail.get(s['key'], [])

    # building units coverage (each site point inside a unit of data/building-units)
    unit_boxes = []
    for fn in os.listdir(a.units):
        if fn.endswith('.json') and fn != 'index.json':
            for u in json.load(open(os.path.join(a.units, fn), encoding='utf-8')).get('units', []):
                unit_boxes.append(u['bbox'])
    checks['sitesOutsideBuildingUnits'] = [s['key'] for s in sites if s['lat'] is not None and not any(
        b[0] <= s['lon'] <= b[2] and b[1] <= s['lat'] <= b[3] for b in unit_boxes)]

    # ---------- roster points (2566 records no demo site represents) ----------
    represented = {n for v in hist_by_site.values() for n in v}
    roster_points, roster_dropped = [], []
    for r in tabs['38_CAMPUS_SPATIAL_STATUS']:
        sid = r['spatial_scope_id']
        if not sid.startswith('SPATIAL-MHESI2566-R') or r['spatial_status'] != 'historical_point_candidate_only':
            continue
        n = int(sid.rsplit('R', 1)[1])
        if n in represented or r['coordinate_status'] != 'valid_Thailand_bbox_candidate_not_entrance':
            continue
        rec = roster_by_rec[n]
        lat, lon = num(r['latitude_candidate']), num(r['longitude_candidate'])
        prov, dist, how = districts.find(lon, lat)
        named = province_of(rec['province_raw'])
        if prov != named:  # a candidate coordinate that contradicts its own record's province is not drawn
            roster_dropped.append({'record': n, 'name': clean(rec['institution_name_raw']), 'recordProvince': named,
                                   'pointProvince': prov or '', 'lookup': how})
            continue
        refs = jlist(r['university_reference_ids_json'])
        roster_points.append({'key': f'R2566-{n:06d}', 'name': clean(rec['institution_name_raw']), 'type': roster_type(rec),
                              'campus': clean(rec['campus_type_raw']), 'lat': round(lat, 6), 'lon': round(lon, 6),
                              'province': prov, 'district': dist or '',
                              'uni': uni_idx[refs[0]] if len(refs) == 1 and refs[0] in uni_idx else -1})
    checks['rosterPointsNotDrawn'] = roster_dropped

    # ---------- campus geometry, faculty memberships (29–31) ----------
    site_idx = {s['key']: i for i, s in enumerate(sites)}
    geometry = []
    geom_idx = {}
    for r in tabs['30_DEMO_GEOMETRY']:
        if not r['selection_status'].startswith('selected'):
            continue
        if r['campus_site_id'] not in site_idx:
            continue
        role = GEOM_ROLES.get(r['feature_role'])
        if not role:
            sys.exit(f'30_DEMO_GEOMETRY: unknown role {r["feature_role"]!r}')
        if r['physical_student_allocation_allowed'] != 'FALSE' or r['legal_boundary_verified'] != 'FALSE':
            sys.exit(f'{r["geometry_id"]}: an allocation or a legal boundary the demo does not draw')
        g = json.loads(r['geojson_geometry'])

        def rnd(c):
            return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 6), round(c[1], 6)]
        g = {'type': g['type'], 'coordinates': rnd(g['coordinates'])}
        geom_idx[r['geometry_id']] = len(geometry)
        # a point inside a polygon (deterministic): what the page joins to the drawn buildings (display only)
        pt = list(interior_point(g)) if g['type'] in ('Polygon', 'MultiPolygon') else [g['coordinates'][1], g['coordinates'][0]]
        geometry.append({'id': r['geometry_id'], 'site': site_idx[r['campus_site_id']], 'role': role, 'feature': r['feature_role'],
                         'name': clean(r['name']), 'g': g, 'pt': [pt[1], pt[0]], 'm2': num(r['area_m2_derived']), 'license': clean(r['source_license']),
                         'credit': clean(r['attribution']), 'src': public_url(r['source_url']), 'version': clean(r['source_version']),
                         'modified': (r['source_modified_at'] or '')[:10], 'checked': iso(r['checked_on']),
                         'evidence': [u for u in (public_url(x) for x in jlist(r['official_evidence_urls'])) if u]})
    for s in sites:
        s['extentGeom'] = geom_idx.get(s['extent'], -1)
        s['extentM2'] = geometry[s['extentGeom']]['m2'] if s['extentGeom'] >= 0 else None
    site_faculties = collections.defaultdict(list)
    for r in tabs['31_DEMO_UNIT_SITES']:
        if not r['campus_site_id']:
            report['notes'].append(f'31_DEMO_UNIT_SITES {r["faculty_site_id"]}: no campus site in the source; not shown')
            continue
        si = site_idx.get(r['campus_site_id'])
        if si is None:
            sys.exit(f'31_DEMO_UNIT_SITES: unknown site {r["campus_site_id"]}')
        gids = [geom_idx[g] for g in jlist(r['selected_geometry_ids']) if g in geom_idx]
        ctx = r['academic_unit_context_id']
        # `uf`: the faculty's index in the site's linked unit's faculty list (02), so the page can name the unit's
        # other academic units without a location; -1 when it is not one of them.
        place = faculty_place.get(ctx)
        su = sites[si]['unit']
        uf = place[1] if place and su >= 0 and units[su]['key'] == place[0] else -1
        site_faculties[si].append({'name': clean(r['faculty_name_th']), 'kind': clean(r['unit_kind']),
                                   'students': unit_ctx_students.get(ctx), 'uf': uf,
                                   'info': public_url(r['faculty_information_url']), 'source': public_url(r['membership_source_url']),
                                   'geoms': gids, 'coverage': clean(r['geometry_coverage']), 'checked': iso(r['checked_on'])})
    for si, lst in site_faculties.items():
        lst.sort(key=lambda f: (-(f['students'] or 0), f['name']))
        sites[si]['faculties'] = len(lst)
    # Located faculties that are not an academic unit of their site's linked unit (shown, never subtracted).
    checks['siteFacultiesOutsideLinkedUnit'] = sum(1 for lst in site_faculties.values() for f in lst if f['uf'] < 0)
    for s in sites:
        s.setdefault('faculties', 0)

    # ---------- programmes and fees of the pilot campuses (32, 33, 36) ----------
    links = collections.defaultdict(list)
    for r in tabs['33_DEMO_FEE_LINKS']:
        links[r['offering_id']].append(r)
    calcs = collections.defaultdict(list)
    for r in tabs['36_DEMO_FEE_CALCS']:
        calcs[r['offering_id']].append({'metric': r['metric'], 'amount': amount(r['amount']), 'currency': r['currency'],
                                        'method': clean(r['method']), 'status': clean(r['status'])})
    offerings = collections.defaultdict(list)
    fee_rows = 0
    for r in tabs['32_DEMO_OFFERINGS']:
        si = site_idx.get(r['campus_site_id'])
        if si is None:
            continue
        fees = []
        for f in links.get(r['offering_id'], []):
            amt = amount(f['amount'])
            if amt is None:
                continue
            fees.append({'type': f['programme_type'], 'component': f['fee_component'], 'amount': amt, 'currency': f['currency'],
                         'period': f['payment_period'], 'category': f['student_fee_category'], 'cohort': f['admission_cohort'],
                         'year': f['academic_year_be'], 'estimate': f['estimate_status'], 'selection': f['selection_status'],
                         'src': public_url(f['source_url']), 'locator': clean(f['source_locator'])})
        fee_rows += len(fees)
        offerings[si].append({'id': r['offering_id'], 'faculty': clean(r['source_faculty_label']), 'name': clean(r['programme_name_th']),
                              'level': DEGREE.get(r['degree_level'], 'other'), 'year': r['academic_year_be'], 'term': r['entry_term'],
                              'cohort': r['admission_cohort'], 'kind': r['record_kind'], 'selection': r['selection_status'],
                              'src': public_url(r['source_url']), 'checked': iso(r['checked_on']), 'fees': fees,
                              'calcs': calcs.get(r['offering_id'], [])})
    for si, lst in offerings.items():
        lst.sort(key=lambda o: (o['faculty'], o['level'], o['name']))
        sites[si]['offerings'] = len(lst)
        sites[si]['feeOfferings'] = sum(1 for o in lst if o['fees'])
    for s in sites:
        s.setdefault('offerings', 0)
        s.setdefault('feeOfferings', 0)

    # ---------- quality (08) and fee coverage (26), per university ----------
    quality = collections.defaultdict(list)
    for r in tabs['08_QUALITY']:
        ui = uni_idx.get(r['university_reference_id'])
        if ui is None:
            continue
        quality[ui].append({'framework': clean(r['framework']), 'authority': clean(r['authority']), 'scope': clean(r['scope_level']),
                            'programme': clean(r['programme_name_source']), 'faculty': clean(r['faculty_name_source']),
                            'status': clean(r['status_at_2026_10_31']), 'from': clean(r['valid_from']), 'until': clean(r['valid_until']),
                            'src': public_url(r['source_url']), 'checked': iso(r['checked_on'])})
    fee_cov = {}
    for r in tabs['26_FEE_COVERAGE']:
        ui = uni_idx.get(r['university_reference_id'])
        if ui is None:
            continue
        fee_cov[ui] = {'observations': whole(r['fee_observations']) or 0, 'sources': whole(r['official_sources_captured']) or 0,
                       'status': clean(r['source_price_availability_status']),
                       'urls': [u for u in (public_url(x) for x in re.split(r'\s*\|\s*', r['primary_urls'] or '')) if u][:4],
                       'checked': iso(r['checked_on'])}
    for i, u in enumerate(unis):
        u['quality'] = quality.get(i, [])
        u['fees'] = fee_cov.get(i)
        u['units'] = sum(1 for x in units if x['uni'] == u['key'])
        u['sites'] = sum(1 for s in sites if s['uni'] == i)

    # ---------- sources (10_SOURCES rows the build used) ----------
    src_rows = {r['source_url']: r for r in tabs['10_SOURCES']}
    student_src = src_rows.get('https://info.mhesi.go.th/open_data/univ_std_11_01_2568_2.csv')
    if not student_src or student_src['source_sha256'] != ctx_rows[0]['source_sha256']:
        sys.exit('10_SOURCES does not record the student file the units cite')
    roster_url = roster[0]['source_url']

    # ---------- provinces: totals for the checks ----------
    by_prov = collections.Counter()
    for u in units:
        by_prov[u['province']] += u['students']
    report['counts'] = {
        'units': len(units), 'students': total, 'universities': len(unis), 'universitiesWithUnits': sum(1 for u in unis if u['units']),
        'provincesWithUnits': len(by_prov), 'provincesWithoutUnits': sorted(set(prov_codes) - set(by_prov)),
        'sites': len(sites), 'sitesWithPoint': site_points, 'sitesWithExtent': sum(1 for s in sites if s['extentGeom'] >= 0),
        'sitesLinked': sum(1 for s in sites if s['unit'] >= 0), 'linkedStudents': sum(units[s['unit']]['students'] for s in sites if s['unit'] >= 0),
        'linkKinds': dict(collections.Counter(s['link'] for s in sites if s['link'])),
        'geometry': len(geometry), 'geometryRoles': dict(collections.Counter(g['role'] for g in geometry)),
        'facultyMemberships': sum(len(v) for v in site_faculties.values()), 'offerings': sum(len(v) for v in offerings.values()),
        'feeRows': fee_rows, 'rosterPoints': len(roster_points), 'stations': len(stations), 'logos': len(logos),
        'retailLinks': sum(len(s['retail']) for s in sites), 'topProvinces': by_prov.most_common(5),
    }

    # ---------- write ----------
    def intern_list(values):
        out = sorted(set(values))
        return out, {v: i for i, v in enumerate(out)}

    # universities the demo shows: with a 2568/2 unit, a demo site or a drawn roster point (01 also lists names of
    # earlier periods only; those stay in the sheet)
    used = {uni_idx[u['uni']] for u in units} | {s['uni'] for s in sites} | {p['uni'] for p in roster_points if p['uni'] >= 0}
    keep = sorted(used)
    remap = {old: new for new, old in enumerate(keep)}
    checks['universitiesNotShown'] = len(unis) - len(keep)
    for s in sites:
        s['uni'] = remap[s['uni']]
    for p in roster_points:
        p['uni'] = remap[p['uni']] if p['uni'] >= 0 else -1
    unis = [unis[i] for i in keep]
    uni_idx = {u['key']: i for i, u in enumerate(unis)}
    report['counts']['universities'] = len(unis)
    if any(not u['type'] for u in unis):
        sys.exit('a shown university has no institution type')
    checks.pop('universitiesWithoutType', None)
    report['counts']['rosterPoints'] = len(roster_points)

    provinces_used, prov_i = intern_list([u['province'] for u in units] + [s['province'] for s in sites if s['province']] + [p['province'] for p in roster_points])
    type_ids = [t[0] for t in TYPES]

    def col(rows, key, f=lambda v: v):
        return [f(r[key]) for r in rows]
    meta = {
        'dataset': 'CityMETER University', 'datasetTh': 'CityMETER University',
        'registryId': 'research.TH.university', 'registryGroup': 'Living',
        'sheetTitle': SHEET_TITLE, 'sheetModified': a.sheet_modified, 'readOn': a.read_on,
        'readMethod': 'the owner’s .xlsx export of the whole workbook (Google Sheets, read 2026-11-12), every tab converted to CSV with exact cell values',
        'exportSha256': sha256_file(a.xlsx), 'tabs': tab_meta,
        'period': {'be': PERIOD[0], 'semester': PERIOD[1], 'label': '2568/2', 'labelEn': 'academic year 2568 (2025), semester 2'},
        'checkedOn': '2026-11-10',
        'sources': {
            'students': {'th': 'แฟ้มนักศึกษา อว. ปีการศึกษา 2568 ภาค 2', 'en': 'MHESI student file, academic year 2568 semester 2',
                         'url': student_src['source_url'], 'sha256': student_src['source_sha256'], 'checked': iso(student_src['checked_on']),
                         'rights': student_src['rights_status']},
            'roster': {'th': 'ทะเบียนสถานศึกษา อว. ปีการศึกษา 2566', 'en': 'MHESI institution roster, academic year 2566',
                       'url': roster_url, 'sha256': roster[0]['source_sha256'], 'checked': iso(roster[0]['checked_on'])},
            'osm': {'th': 'กรอบพื้นที่และอาคารจาก OpenStreetMap', 'en': 'OpenStreetMap areas and buildings', 'license': 'ODbL-1.0',
                    'credit': '© OpenStreetMap contributors'},
        },
        'counts': report['counts'],
        'context': {
            'rail': {'source': 'CityMETER · Transit (montri-th/transit)', 'commit': repo_commit(a.transit), 'file': 'data/transit.json',
                     'sha256': sha256_file(transit_path), 'release': (transit.get('meta') or {}).get('release', ''),
                     'asOf': (transit.get('meta') or {}).get('asOf', ''), 'maxM': RAIL_MAX_M},
            'retail': {'source': 'CityMETER Shopping centers (montri-th/shoppingcenter)', 'commit': repo_commit(a.shopping),
                       'file': 'data/venues.json', 'sha256': sha256_file(shop_path)},
            'districts': {'source': a.frames_ref, 'use': 'a site’s เขต/อำเภอ by its point, at build time'},
            'logos': {'file': os.path.basename(a.logo_zip), 'sha256': sha256_file(a.logo_zip), 'tab': 'LOGO_LIBRARY',
                      'rights': 'Source artwork retained. Reuse terms not established in source. (LOGO_LIBRARY.rights_notice)'},
        },
        'types': [{'id': t[0], 'th': t[1], 'en': t[2]} for t in TYPES],
        'excludedFields': EXCLUDED,
    }
    data = {
        'meta': meta,
        'provinces': provinces_used,
        'universities': [{k: u.get(k, '') for k in ('key', 'name', 'type', 'typeFrom', 'students', 'latest', 'units', 'sites', 'feeObs', 'qualityObs', 'logo', 'fees')} for u in unis],
        'units': {
            'key': col(units, 'key'), 'name': col(units, 'name'), 'uni': [uni_idx[u['uni']] for u in units],
            'province': [prov_i[u['province']] for u in units], 'type': [type_ids.index(u['type']) for u in units],
            'students': col(units, 'students'), 'male': col(units, 'male'), 'female': col(units, 'female'),
            'ba': col(units, 'ba'), 'ma': col(units, 'ma'), 'phd': col(units, 'phd'), 'other': col(units, 'other'),
            'programmes': col(units, 'programmes'), 'faculties': col(units, 'faculties'),
        },
        'sites': {
            'key': col(sites, 'key'), 'name': col(sites, 'name'), 'uni': col(sites, 'uni'),
            'type': [type_ids.index(s['type']) if s['type'] else -1 for s in sites], 'kind': col(sites, 'kind'),
            'lat': col(sites, 'lat'), 'lon': col(sites, 'lon'), 'coord': col(sites, 'coord'),
            'province': [prov_i[s['province']] if s['province'] else -1 for s in sites], 'district': col(sites, 'district'),
            'unit': col(sites, 'unit'), 'link': col(sites, 'link'), 'extent': col(sites, 'extentGeom'), 'extentM2': col(sites, 'extentM2'),
            'officialArea': col(sites, 'officialArea'), 'officialUrl': col(sites, 'officialUrl'), 'address': col(sites, 'address'),
            'faculties': col(sites, 'faculties'), 'offerings': col(sites, 'offerings'), 'feeOfferings': col(sites, 'feeOfferings'),
            'rail': col(sites, 'rail'), 'railM': col(sites, 'railM'), 'rail2': col(sites, 'rail2'), 'rail2M': col(sites, 'rail2M'),
            'retail': col(sites, 'retail'), 'roster': col(sites, 'roster'), 'pilot': col(sites, 'pilot'), 'checked': col(sites, 'checked'),
        },
        'roster': {
            'key': col(roster_points, 'key'), 'name': col(roster_points, 'name'), 'type': [type_ids.index(p['type']) for p in roster_points],
            'campus': col(roster_points, 'campus'), 'lat': col(roster_points, 'lat'), 'lon': col(roster_points, 'lon'),
            'province': [prov_i[p['province']] for p in roster_points], 'district': col(roster_points, 'district'), 'uni': col(roster_points, 'uni'),
        },
        'stations': stations,
    }
    campus = {
        'meta': {'dataset': 'CityMETER University', 'part': 'campus', 'sheetTitle': SHEET_TITLE, 'readOn': a.read_on,
                 'exportSha256': meta['exportSha256'], 'tabs': {t: tab_meta[t] for t in ('29_DEMO_SITES', '30_DEMO_GEOMETRY', '31_DEMO_UNIT_SITES', '32_DEMO_OFFERINGS', '33_DEMO_FEE_LINKS', '36_DEMO_FEE_CALCS')},
                 'credit': '© OpenStreetMap contributors (ODbL 1.0) for areas and buildings from OpenStreetMap; other sources per feature',
                 'rules': ['a polygon is an approximate extent for the map, never a legal boundary or land holding',
                           'a faculty building is evidence of a membership, never the faculty’s whole territory',
                           'students are never allocated to a site, a polygon or a building',
                           'a fee is shown as its source writes it: one programme, one mode, one period; never summed, averaged or annualised']},
        'geometry': geometry,
        'faculties': {str(k): v for k, v in sorted(site_faculties.items())},
        'offerings': {str(k): v for k, v in sorted(offerings.items())},
        'quality': {str(i): u['quality'] for i, u in enumerate(unis) if u['quality']},
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'universities.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(a.out, 'campus.json'), 'w', encoding='utf-8') as fh:
        json.dump(campus, fh, ensure_ascii=False, separators=(',', ':'))
    report['builtFrom'] = {'export': meta['exportSha256'], 'tabs': {t: v['sha256'][:16] for t, v in tab_meta.items()}}
    with open(os.path.join(a.out, 'build-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
    print(json.dumps(report['counts'], ensure_ascii=False))
    print(json.dumps({k: (v if not isinstance(v, list) or len(v) < 12 else f'{len(v)} items') for k, v in checks.items()}, ensure_ascii=False))
    for n in report['notes']:
        print('note:', n)


if __name__ == '__main__':
    main()
