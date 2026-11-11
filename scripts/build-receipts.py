#!/usr/bin/env python3
"""Write data/boundary-receipts.json: the receipts of every CityMETER production response this build read.

  base      — base info lv0 (the country list) and lv1 per province (codes, Thai names, areaSqm), fetched by
              scripts/fetch-base.py and read by scripts/build-boundaries.py and scripts/build-data.py (the
              district gazetteer);
  geometry  — full-resolution geometry responses, when a build reads any (`--geom`; CityMETER School reads none:
              its districts come from the source's own district or the display outlines, so the list is empty).

Each receipt is the .meta.json the fetch wrote next to the response: url, HTTP status, bytes, sha256 of the
body and the retrieval time. The response bodies themselves are not published (they are production data,
re-readable from the same public endpoints); the receipts let anyone re-fetch and compare.

`baseSha256` is the same digest data/area-index.json carries as receiptsSha256:
sha256(json.dumps({file: receipt}, sort_keys=True)) with Python's default separators.

Usage: python3 -I scripts/build-receipts.py --api DIR [--geom DIR] --out .
"""
import argparse, hashlib, json, os


def read(directory):
    return {f: json.load(open(os.path.join(directory, f), encoding='utf-8'))
            for f in sorted(os.listdir(directory)) if f.endswith('.meta.json')}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--api', required=True)
    ap.add_argument('--geom', default='')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    base, geom = read(a.api), (read(a.geom) if a.geom else {})
    for name, rs in (('base', base), ('geometry', geom)):
        bad = [f for f, r in rs.items() if r.get('status') != 200 or not str(r.get('url', '')).startswith('https://landometer.com/api/v2/citymeter-v3/base/info/')]
        if bad:
            raise SystemExit(f'{name}: unexpected receipts {bad[:3]}')
    out = {
        'source': 'CityMETER production base info (public read-only API)',
        'baseSha256': hashlib.sha256(json.dumps(base, sort_keys=True).encode()).hexdigest(),
        'geometrySha256': hashlib.sha256(json.dumps(geom, sort_keys=True).encode()).hexdigest(),
        'base': base, 'geometry': geom,
    }
    path = os.path.join(a.out, 'data', 'boundary-receipts.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write('\n')
    print(path, len(base), 'base receipts', len(geom), 'geometry receipts', out['baseSha256'])


if __name__ == '__main__':
    main()
