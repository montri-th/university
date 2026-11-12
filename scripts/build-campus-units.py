#!/usr/bin/env python3
"""Building source round the campuses (owner 2026-11-12 07:31, VERBATIM: “ในต่างจังหวัดที่อาคาร 3d ของ OSM มีน้อยหรือ
ไม่มี ไม่ได้เอา CityMETER มาเสริมให้”).

data/building-units/ came from the CityMETER · Hotel build (via CityMETER · School): every อปท. holding a hotel with a
point, Bangkok every เขต. An อปท. round a campus that holds no hotel was never evaluated, so the map drew OpenStreetMap
there however few buildings OSM maps. This script evaluates those units by the same rule (owner 2026-11-01, point 3:
CityMETER Building V4 where its count is at least 1.15 × the OpenStreetMap count of the same unit, else OSM; both under
10 buildings → flagged gap) and adds them to data/building-units/, leaving every existing unit, its slot and its file
order unchanged.

Selection: every อปท. (production base info `municipalityInfos`, Bangkok excluded — every เขต is a unit already) whose
production outline meets the surroundings square of a campus — the square js/app.js draws in detail round a campus
(`SITE_CONTEXT_MIN_M`, `SITE_CONTEXT_PAD_M`; centre of the extent's box, or the point) — and that the Hotel build did
not evaluate.

Three stages, the middle one in a browser (the build container cannot reach Overpass):

  python3 -I scripts/build-campus-units.py fetch --api $BUILD/api --data data --units data/building-units --out $BUILD/campus-units
      outlines (production base/info/geom/{id}/MUNICIPALITY) and CityMETER V4 counts (production
      building/info/lv1/{province}?version=V4) for the units whose box meets a square, each response with a receipt
      (<file>.meta.json: url, status, bytes, sha256, retrievedAt); writes plan.json: the units whose outline meets a
      square, with their CityMETER count, box and Overpass polygons (outer rings and holes, ≤ 200 vertices).
  scripts/count-osm-buildings.js (in a browser tab; see its header) reads plan.json and writes osm-counts.json:
      ways tagged building=* per unit (Overpass `out count`): the box count is an upper bound and decides where it is
      0 or 1.15 × it is still ≤ the CityMETER count; otherwise the polygon count (outer rings minus holes).
  python3 -I scripts/build-campus-units.py apply --plan $BUILD/campus-units/plan.json --counts osm-counts.json \
      --units data/building-units
      decides each unit by the rule and writes it into its province file (new tile units take the next free slots), the
      index's per-province summary (bytes, SHA-256) and meta.campusUnits (selection, counts, receipts' SHA-256).
"""
import argparse, collections, datetime, glob, hashlib, json, math, os, sys, time, urllib.request

API = 'https://landometer.com/api/v2/citymeter-v3/'
SITE_CONTEXT_MIN_M, SITE_CONTEXT_PAD_M = 1000, 800   # js/app.js
RATIO, THIN = 1.15, 10                               # the Hotel build's rule (owner 2026-11-01)
SIMPLIFY_DEG, MAX_VERTICES = 0.0001, 240             # unit outline on the map (the Hotel build)
POLY_MAX_VERTICES = 200                              # Overpass polygon filter (the Hotel build's counts)
CM_SLOTS = 8192                                      # js/massing.js


# ---------- geometry ----------
def dp(points, eps):
    """Douglas–Peucker on an OPEN polyline (first and last points kept)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        (x1, y1), (x2, y2) = points[s], points[e]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        idx, dmax = -1, eps
        for i in range(s + 1, e):
            px, py = points[i]
            d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / length if length else math.hypot(px - x1, py - y1)
            if d > dmax:
                idx, dmax = i, d
        if idx > 0:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [p for p, k in zip(points, keep) if k]


def simplify(ring, max_vertices=MAX_VERTICES):
    """A closed ring simplified to at most max_vertices (split at the vertex farthest from the first) — the Hotel build's."""
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else list(ring)
    if len(pts) < 3:
        return None
    k = max(range(1, len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    eps = SIMPLIFY_DEG
    while True:
        a = dp(pts[:k + 1], eps)
        b = dp(pts[k:] + [pts[0]], eps)
        out = a + b[1:-1]
        if len(out) <= max_vertices or eps > 0.05:
            break
        eps *= 1.4
    out = [[round(x, 5), round(y, 5)] for x, y in out]
    dedup = [p for i, p in enumerate(out) if i == 0 or p != out[i - 1]]
    dedup.append(dedup[0])
    return dedup if len(dedup) >= 4 else None


def ring_area(r):
    return abs(sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r)))) / 2


def polygons_of(geom):
    if not geom:
        return []
    return [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates'] if geom['type'] == 'MultiPolygon' else []


def outline(geom, max_vertices=MAX_VERTICES):
    out = []
    for p in polygons_of(geom):
        if not p or ring_area(p[0]) < 1e-9:
            continue
        outer = simplify(p[0], max_vertices)
        if not outer:
            continue
        holes = [h for h in (simplify(h, max_vertices) for h in p[1:] if ring_area(h) >= 1e-9) if h]
        out.append([outer] + holes)
    return out


def lonlat_bbox(extent):
    """EPSG:3857 [minx, miny, maxx, maxy] → lon/lat [w, s, e, n] (5 decimals)."""
    lon = lambda x: x * 180 / 20037508.34
    lat = lambda y: math.degrees(2 * math.atan(math.exp(y / 6378137)) - math.pi / 2)
    return [round(lon(extent[0]), 5), round(lat(extent[1]), 5), round(lon(extent[2]), 5), round(lat(extent[3]), 5)]


def in_ring(x, y, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def cross(p, q, a, b):
    def orient(u, v, w):
        return (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])
    return orient(p, q, a) * orient(p, q, b) < 0 and orient(a, b, p) * orient(a, b, q) < 0


def meets_box(geom, box):
    """True when a (Multi)Polygon meets a lon/lat box [w, s, e, n] (holes count as outside)."""
    w, s, e, n = box
    corners = [(w, s), (e, s), (e, n), (w, n)]
    edges = list(zip(corners, corners[1:] + corners[:1]))
    for p in polygons_of(geom):
        outer, holes = p[0], p[1:]
        if any(w <= x <= e and s <= y <= n for x, y in outer):
            return True
        if any(in_ring(x, y, outer) and not any(in_ring(x, y, h) for h in holes) for x, y in corners):
            return True
        for i in range(len(outer) - 1):
            if any(cross(outer[i], outer[i + 1], a, b) for a, b in edges):
                return True
    return False


def boxes_meet(a, b):
    return a[0] <= b[2] and b[0] <= a[2] and a[1] <= b[3] and b[1] <= a[3]


# ---------- the campuses' surroundings (js/app.js#siteRegions) ----------
def campus_squares(data_dir):
    u = json.load(open(os.path.join(data_dir, 'universities.json'), encoding='utf-8'))
    c = json.load(open(os.path.join(data_dir, 'campus.json'), encoding='utf-8'))
    s = u['sites']
    out = []
    for i, key in enumerate(s['key']):
        ext = s['extent'][i]
        rings = []
        if ext is not None and ext >= 0:
            g = c['geometry'][ext]['g']
            rings = [p[0] for p in polygons_of(g)]
        xs = [x for r in rings for x, _ in r]
        ys = [y for r in rings for _, y in r]
        if xs:
            lon, lat = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            half = max((max(xs) - min(xs)) * 111320 * math.cos(math.radians(lat)), (max(ys) - min(ys)) * 110574) / 2
        elif s['lon'][i] is not None and s['lat'][i] is not None:
            lon, lat, half = s['lon'][i], s['lat'][i], 0
        else:
            continue
        r = max(SITE_CONTEXT_MIN_M, half + SITE_CONTEXT_PAD_M)
        dy, dx = r / 110574, r / (111320 * math.cos(math.radians(lat)))
        out.append({'site': key, 'box': [lon - dx, lat - dy, lon + dx, lat + dy]})
    return out


def existing_units(units_dir):
    ids, slots = set(), {}
    for fn in sorted(glob.glob(os.path.join(units_dir, '*.json'))):
        if fn.endswith('index.json'):
            continue
        for u in json.load(open(fn, encoding='utf-8'))['units']:
            ids.add(u['id'])
            for t in u.get('tileUnits', []):
                slots[t['id']] = t['slot']
    return ids, slots


# ---------- fetch with receipts ----------
def fetch(url, path):
    if os.path.exists(path) and os.path.exists(path[:-5] + '.meta.json'):
        return open(path, 'rb').read()
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CityMETER-University-build/1.0'}), timeout=90) as r:
                body, status = r.read(), r.status
            break
        except Exception:  # noqa: BLE001 — retried, then raised
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)
    json.loads(body)
    with open(path, 'wb') as fh:
        fh.write(body)
    meta = {'url': url, 'status': status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
    with open(path[:-5] + '.meta.json', 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False)
    return body


def cmd_fetch(a):
    os.makedirs(os.path.join(a.out, 'geom'), exist_ok=True)
    os.makedirs(os.path.join(a.out, 'counts'), exist_ok=True)
    lv0 = json.load(open(os.path.join(a.api, 'base-lv0.json'), encoding='utf-8'))['value']['provinceInfos']
    listed, _ = existing_units(a.units)
    squares = campus_squares(a.data)
    candidates = []
    for p in lv0:
        if p['abbrEn'] == 'BKK':
            continue
        base = json.load(open(os.path.join(a.api, f"base-{p['id']}.json"), encoding='utf-8'))['value']
        for m in base['municipalityInfos']:
            if m['id'] in listed:
                continue
            box = lonlat_bbox(m['extent'])
            sites = [q['site'] for q in squares if boxes_meet(box, q['box'])]
            if sites:
                candidates.append({'id': m['id'], 'code': str(m['code']), 'name': m['nameTh'], 'province': p['abbrEn'], 'provinceId': p['id'], 'bbox': box})
    plan, cm_docs = [], {}
    for m in candidates:
        raw = fetch(f"{API}base/info/geom/{m['id']}/MUNICIPALITY", os.path.join(a.out, 'geom', m['id'] + '.json'))
        v = json.loads(raw)['value']
        geom = json.loads(v) if isinstance(v, str) else v
        sites = sorted(q['site'] for q in squares if boxes_meet(m['bbox'], q['box']) and meets_box(geom, q['box']))
        if not sites:
            continue
        if m['provinceId'] not in cm_docs:
            cm_docs[m['provinceId']] = json.loads(fetch(f"{API}building/info/lv1/{m['provinceId']}?version=V4",
                                                        os.path.join(a.out, 'counts', m['province'] + '.json')))['value']
        rows = (cm_docs[m['provinceId']].get('municipalityDatas', {}).get(m['id']) or {}).get('rows') or []
        v4 = [r for r in rows if r.get('v') == 4]
        cm = v4[0].get('count') if v4 else None
        polys = outline(geom, POLY_MAX_VERTICES)
        plan.append({**m, 'sites': sites, 'cm': cm, 'polys': polys, 'outline': outline(geom)})
    plan.sort(key=lambda m: (m['province'], m['code']))
    doc = {'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
           'selection': f'อปท. (municipalityInfos, Bangkok excluded) not evaluated by the Hotel build whose production outline meets a campus surroundings square (max({SITE_CONTEXT_MIN_M} m, half the extent box + {SITE_CONTEXT_PAD_M} m))',
           'candidatesByBox': len(candidates), 'units': plan}
    with open(os.path.join(a.out, 'plan.json'), 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    # The browser's part: only what the Overpass counts need (no outline for the map).
    lean = [{'id': m['id'], 'name': m['name'], 'cm': m['cm'], 'bbox': m['bbox'], 'polys': m['polys']} for m in plan]
    with open(os.path.join(a.out, 'overpass-plan.json'), 'w', encoding='utf-8') as fh:
        json.dump(lean, fh, ensure_ascii=False, separators=(',', ':'))
    print(json.dumps({'candidatesByBox': len(candidates), 'units': len(plan), 'provinces': len(cm_docs),
                      'cmMissing': sum(1 for m in plan if not m['cm'])}, ensure_ascii=False))


# ---------- decide and write ----------
def decide(cm, osm, osm_upper, method):
    """(source, basis) by the 1.15 rule (owner 2026-11-01) — the Hotel build's decide()."""
    if method == 'bbox_upper_bound' and cm and osm_upper is not None and osm_upper * RATIO <= cm:
        return 'cm', 'cm_at_least_1.15x_osm_bbox_upper_bound'
    if osm is None:
        return 'osm', 'osm_count_unavailable_status_quo'
    if cm and cm >= RATIO * osm:
        return 'cm', 'cm_at_least_1.15x_osm'
    return 'osm', 'cm_below_1.15x_osm' if cm else 'cm_count_unavailable'


def is_gap(cm, osm, osm_upper):
    o = osm if osm is not None else osm_upper
    return (cm or 0) < THIN and o is not None and o < THIN


def cmd_apply(a):
    plan = json.load(open(a.plan, encoding='utf-8'))
    counts_raw = open(a.counts, 'rb').read()
    counts = {r['id']: r for r in json.loads(counts_raw)['rows']}
    listed, slots = existing_units(a.units)
    next_slot = max(slots.values(), default=-1) + 1
    index_path = os.path.join(a.units, 'index.json')
    index = json.load(open(index_path, encoding='utf-8'))
    by_province = collections.defaultdict(list)
    tally = collections.Counter()
    for m in plan['units']:
        if m['id'] in listed:
            continue
        r = counts.get(m['id'])
        if not r:
            raise SystemExit(f"no OSM count for {m['id']} {m['name']}")
        src, basis = decide(m['cm'], r.get('osm'), r.get('osmUpper'), r.get('osmMethod'))
        u = {'id': m['id'], 'code': m['code'], 'name': m['name'], 'kind': 'municipality', 'source': src, 'basis': basis,
             'cm': m['cm'], 'osm': r.get('osm'), 'osmUpper': r.get('osmUpper'), 'osmMethod': r.get('osmMethod'),
             'gap': is_gap(m['cm'], r.get('osm'), r.get('osmUpper')), 'bbox': m['bbox'], 'osmBaseDay': r.get('osmBaseDay'),
             'campusSurroundings': True}
        if src == 'cm':
            if not m['outline']:
                raise SystemExit(f"no outline for {m['id']} {m['name']}")
            assert next_slot < CM_SLOTS, 'tile-unit index exceeds the id space'
            u.update({'tileType': 'MUNICIPALITY', 'tileUnits': [{'id': m['id'], 'bbox': m['bbox'], 'slot': next_slot}], 'outline': m['outline']})
            next_slot += 1
        by_province[m['province']].append(u)
        tally[src] += 1
        tally['gap'] += u['gap']
    summary = {p['province']: p for p in index['provinces']}
    for prov, added in sorted(by_province.items()):
        path = os.path.join(a.units, f'{prov}.json')
        doc = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {'province': prov, 'units': []}
        doc['units'] = doc['units'] + sorted(added, key=lambda u: u['code'])
        raw = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        open(path, 'wb').write(raw)
        c = collections.Counter(u['source'] for u in doc['units'])
        row = summary.get(prov) or {'province': prov}
        row.update({'units': len(doc['units']), 'cm': c['cm'], 'osm': c['osm'], 'gap': sum(1 for u in doc['units'] if u['gap']),
                    'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
        summary[prov] = row
    index['provinces'] = sorted(summary.values(), key=lambda p: p['province'])
    totals = collections.Counter()
    for p in index['provinces']:
        totals['cm'] += p.get('cm', 0); totals['osm'] += p.get('osm', 0); totals['gap'] += p.get('gap', 0)
    meta = index['meta']
    meta['totals'] = dict(totals)
    meta['campusUnits'] = {
        'owner': '2026-11-12 07:31 — CityMETER to supplement OSM round the campuses in the provinces',
        'selection': plan['selection'], 'rule': 'the Hotel build\'s, unchanged (1.15 ×, gap under 10)',
        'added': dict(tally), 'units': sum(len(v) for v in by_province.values()),
        'cm': 'production building/info/lv1/{province}?version=V4 (v = 4 row, whole unit)',
        'osm': 'Overpass API out count of ways tagged building=*: the box count is an upper bound; polygon count (outer rings minus holes, ≤ 200 vertices) where it does not decide',
        'osmBase': sorted({r.get('osmBase') for r in counts.values() if r.get('osmBase')}),
        'countsSha256': hashlib.sha256(counts_raw).hexdigest(), 'planSha256': hashlib.sha256(open(a.plan, 'rb').read()).hexdigest(),
        'builtAt': plan['builtAt'],
    }
    raw = json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    open(index_path, 'wb').write(raw)
    print(json.dumps({'added': dict(tally), 'provinces': len(by_province), 'nextSlot': next_slot, 'totals': dict(totals)}, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    f = sub.add_parser('fetch')
    f.add_argument('--api', required=True)
    f.add_argument('--data', required=True)
    f.add_argument('--units', required=True)
    f.add_argument('--out', required=True)
    p = sub.add_parser('apply')
    p.add_argument('--plan', required=True)
    p.add_argument('--counts', required=True)
    p.add_argument('--units', required=True)
    a = ap.parse_args()
    {'fetch': cmd_fetch, 'apply': cmd_apply}[a.cmd](a)


if __name__ == '__main__':
    main()
