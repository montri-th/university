#!/usr/bin/env python3
"""Build the district index and district outlines of CityMETER · School (the same builder as CityMETER · Hotel and Fitness).

The analytical unit of this product is the เขต/อำเภอ (DISTRICT) of CityMETER production. Its outlines are the
display outlines CityMETER · Pharmacy already published from the same production API (montri-th/pharmacy,
data/frames/{CODE}.json → `districts`, dissolved from production subdistricts simplified with mapshaper
interval=30, retrieved 2026-10-23, 7,514 receipts in that repository's data/boundary-receipts.json). The
coordinates are copied unchanged; only the feature properties are slimmed to {id, name, province}.

Names, codes and production areaSqm are re-read from today's production base info (--api, with receipts) and
must agree with the copied outlines: every district code of production must have exactly one outline.
English district names (search and address reading only) come from OpenGISData-Thailand @ fafcea1 (CC BY 4.0).

Inputs:
  --pharmacy   a checkout of montri-th/pharmacy (data/frames/, data/area-index.json, data/provinces.geojson)
  --api        production base info responses (base-lv0.json, base-{uuid}.json + .meta.json receipts)
  --ogd        OpenGISData-Thailand districts.geojson at commit fafcea1
Outputs (under --out): data/area-index.json, data/frames/{CODE}.json, data/provinces.geojson
"""
import argparse, hashlib, json, os, shutil, subprocess, sys

OGD_COMMIT = 'fafcea179cda88b689f5697c3866a449e79cd298'


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--pharmacy', required=True)
    ap.add_argument('--api', required=True)
    ap.add_argument('--ogd', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    commit = subprocess.run(['git', '-C', a.pharmacy, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    ph_index = json.load(open(os.path.join(a.pharmacy, 'data/area-index.json'), encoding='utf-8'))
    ph_meta = ph_index['metadata']
    lv0 = json.load(open(os.path.join(a.api, 'base-lv0.json'), encoding='utf-8'))['value']
    ogd_path = os.path.join(a.ogd, 'districts.geojson')
    ogd = {f['properties']['amp_code']: f['properties'] for f in json.load(open(ogd_path, encoding='utf-8'))['features']}

    # Label points and bboxes of the copied outlines (pharmacy index, same geometry).
    ph_d = ph_index['districts']
    ph_label = {ph_d['id'][i]: (ph_d['label'][i], ph_d['bbox'][i]) for i in range(len(ph_d['id']))}
    ph_prov = {p['id']: p for p in ph_index['provinces']}

    provinces, areas = [], {k: [] for k in ('id', 'name', 'nameEn', 'province', 'areaSqm', 'label', 'bbox')}
    os.makedirs(os.path.join(a.out, 'data/frames'), exist_ok=True)
    problems = []
    frame_hashes = {}
    for p in lv0['provinceInfos']:
        code = p['abbrEn']
        base = json.load(open(os.path.join(a.api, f"base-{p['id']}.json"), encoding='utf-8'))['value']
        src = json.load(open(os.path.join(a.pharmacy, f'data/frames/{code}.json'), encoding='utf-8'))
        outlines = {str(f['id']): f for f in src['districts']['features']}
        prod = {d['code']: d for d in base['districtInfos']}
        if set(prod) != set(outlines):
            problems.append(f'{code}: production districts {sorted(set(prod) ^ set(outlines))} differ from the outlines')
        features = []
        for dcode in sorted(prod):
            d = prod[dcode]
            f = outlines.get(dcode)
            if not f:
                continue
            features.append({'type': 'Feature', 'id': dcode, 'properties': {'id': dcode, 'name': d['nameTh'], 'province': code},
                             'geometry': f['geometry']})
            label, bbox = ph_label.get(dcode, (None, None))
            areas['id'].append(dcode)
            areas['name'].append(d['nameTh'])
            areas['nameEn'].append((ogd.get(dcode) or {}).get('amp_en') or '')
            areas['province'].append(code)
            areas['areaSqm'].append(d.get('areaSqm'))
            areas['label'].append(label)
            areas['bbox'].append(bbox)
        frame = {'metadata': {'source': ph_meta['source'], 'geometryEndpoint': ph_meta['geometryEndpoint'], 'retrievedOn': ph_meta['retrievedOn'],
                              'outlines': f'montri-th/pharmacy@{commit[:7]} data/frames/{code}.json → districts (coordinates unchanged)',
                              'simplification': ph_meta['simplification'],
                              'limits': 'District outlines for navigation and aggregation of this dataset; not an official boundary certificate.'},
                 'areas': {'type': 'FeatureCollection', 'features': features}}
        path = os.path.join(a.out, f'data/frames/{code}.json')
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(frame, fh, ensure_ascii=False, separators=(',', ':'))
        frame_hashes[code] = sha256(path)
        pp = ph_prov.get(code, {})
        provinces.append({'id': code, 'code': p['code'], 'uuid': p['id'], 'name': p['nameTh'], 'nameEn': p['nameEn'], 'areaSqm': p.get('areaSqm'),
                          'districts': len(features), 'label': pp.get('label'), 'bbox': pp.get('bbox')})
    if problems:
        sys.exit('\n'.join(problems))
    receipts = {f: json.load(open(os.path.join(a.api, f))) for f in sorted(os.listdir(a.api)) if f.endswith('.meta.json')}
    index = {
        'metadata': {
            'source': 'CityMETER production base info (public read-only API): codes, Thai names, areaSqm',
            'attributeEndpoint': 'https://landometer.com/api/v2/citymeter-v3/base/info/lv1/{province uuid}',
            'retrievedOn': min(m['retrievedAt'][:10] for m in receipts.values()),
            'receipts': len(receipts), 'receiptsSha256': hashlib.sha256(json.dumps(receipts, sort_keys=True).encode()).hexdigest(),
            'outlines': f'montri-th/pharmacy@{commit} data/frames (production SUBDISTRICT geometry retrieved {ph_meta["retrievedOn"]}, '
                        f'receipts {ph_meta["receipts"]} · sha256 {ph_meta["receiptsSha256"]})',
            'englishNames': f'OpenGISData-Thailand districts.geojson @ {OGD_COMMIT[:7]} (CC BY 4.0, DOPA-credited) sha256 {sha256(ogd_path)}',
            'areaSqm': 'production value from base info; never recomputed from the simplified outline',
            'frames': frame_hashes,
            'limits': 'Administrative frames for navigation and aggregation of this dataset; not an official boundary certificate.',
        },
        'provinces': provinces,
        'areas': areas,
    }
    with open(os.path.join(a.out, 'data/area-index.json'), 'w', encoding='utf-8') as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))
    shutil.copyfile(os.path.join(a.pharmacy, 'data/provinces.geojson'), os.path.join(a.out, 'data/provinces.geojson'))
    print('provinces', len(provinces), 'districts', len(areas['id']), 'frames', len(frame_hashes))


if __name__ == '__main__':
    main()
