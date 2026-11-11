#!/usr/bin/env python3
"""Fetch CityMETER production base info (the gazetteer this build reads) with a receipt per response.

  base-lv0.json          https://landometer.com/api/v2/citymeter-v3/base/info/lv0          (77 provinces)
  base-{uuid}.json       https://landometer.com/api/v2/citymeter-v3/base/info/lv1/{uuid}   (districts, subdistricts)

Every response is written unchanged next to `<file>.meta.json` = {url, status, bytes, sha256, retrievedAt}. The
bodies stay in the build directory (production data, re-readable from the same public endpoints); only the
receipts are published (data/boundary-receipts.json, scripts/build-receipts.py).

Usage: python3 -I scripts/fetch-base.py --out DIR
"""
import argparse, datetime, hashlib, json, os, time, urllib.request

API = 'https://landometer.com/api/v2/citymeter-v3/base/info/'


def fetch(url, path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CityMETER-School-build/1.0'}), timeout=60) as r:
                body, status = r.read(), r.status
            break
        except Exception as e:  # noqa: BLE001 — retried, then raised
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)
    json.loads(body)  # must parse
    with open(path, 'wb') as fh:
        fh.write(body)
    meta = {'url': url, 'status': status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
    with open(path[:-5] + '.meta.json', 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False)
    return body


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    lv0 = json.loads(fetch(API + 'lv0', os.path.join(a.out, 'base-lv0.json')))['value']
    for p in lv0['provinceInfos']:
        fetch(API + 'lv1/' + p['id'], os.path.join(a.out, f"base-{p['id']}.json"))
    print('provinces', len(lv0['provinceInfos']))


if __name__ == '__main__':
    main()
