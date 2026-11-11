#!/usr/bin/env python3
"""Reuse the building-source units of CityMETER · Hotel for School (owner rule 2026-11-01, point 3: per อปท./เขต,
CityMETER Building V4 where its count is at least 1.15 × the OpenStreetMap count of the same unit, else OSM).

The Hotel build (montri-th/hotel scripts/build-building-units.py) evaluated every อปท. that holds a hotel with a point
(Bangkok: every เขต) against production building counts and Overpass counts. School reuses those units unchanged —
outline, tile units, counts, source — and draws OpenStreetMap everywhere else (an อปท. without a hotel was not
evaluated). This script copies them and drops the per-unit hotel counts, so nothing in this repo describes hotels:

  python3 -I scripts/adapt-building-units.py --hotel ../montri-th/hotel --commit <hotel commit> --out data/building-units

Integrity: the index lists the bytes and SHA-256 of every province file it writes.
"""
import argparse, hashlib, json, os, sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hotel', required=True, help='a checkout of montri-th/hotel')
    ap.add_argument('--commit', required=True, help='the Hotel commit the units are read from')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    src = os.path.join(a.hotel, 'data', 'building-units')
    index = json.load(open(os.path.join(src, 'index.json'), encoding='utf-8'))
    os.makedirs(a.out, exist_ok=True)
    meta = index['meta']
    meta['unit'] = ('อปท. (CityMETER production municipalityInfos) evaluated by the CityMETER · Hotel build — every unit '
                    'holding at least one hotel with a point; Bangkok: every เขต (tiles per แขวง). Any other unit draws '
                    'OpenStreetMap.')
    meta['reusedFrom'] = {'repository': 'https://github.com/montri-th/hotel', 'commit': a.commit,
                          'path': 'data/building-units/', 'countsSha256': meta.get('countsSha256', '')}
    provinces = []
    for p in index['provinces']:
        p = dict(p)
        p.pop('hotels', None)
        name = f"{p['province']}.json"
        doc = json.load(open(os.path.join(src, name), encoding='utf-8'))
        for u in doc.get('units', []):
            u.pop('hotels', None)
        raw = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        open(os.path.join(a.out, name), 'wb').write(raw)
        p['bytes'] = len(raw)
        p['sha256'] = hashlib.sha256(raw).hexdigest()
        provinces.append(p)
    index['provinces'] = provinces
    raw = json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    open(os.path.join(a.out, 'index.json'), 'wb').write(raw)
    print(f"{len(provinces)} province files, units {sum(p.get('units', 0) for p in provinces)}; index {len(raw)} bytes",
          file=sys.stderr)


if __name__ == '__main__':
    main()
