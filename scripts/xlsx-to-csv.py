#!/usr/bin/env python3
"""Convert the owner's .xlsx export of the university research master into one CSV per tab, with exact cell values.

    python3 -I scripts/xlsx-to-csv.py <export.xlsx> <out-dir>

Writes <out-dir>/<tab>.csv for every worksheet and <out-dir>/manifest.json (rows, columns and the SHA-256 of each
CSV), which scripts/build-data.py checks before it reads a tab. Values are written as the workbook stores them
(data_only: the cached value of a formula), integers without a decimal point, dates as ISO text; trailing empty
cells and empty rows are dropped. The export and the CSVs are internal: never commit them (tests/release.test.js).
Needs openpyxl (pip install openpyxl).
"""
import csv, datetime, hashlib, json, os, sys, time

import openpyxl


def cell(v):
    if v is None:
        return ''
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, datetime.datetime):
        return v.date().isoformat() if (v.hour, v.minute, v.second, v.microsecond) == (0, 0, 0, 0) else v.isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)
    return str(v)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    t0 = time.time()
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    manifest = {'source': os.path.basename(src), 'sheets': []}
    for ws in wb.worksheets:
        path = os.path.join(outdir, f'{ws.title}.csv')
        n = width = 0
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            for row in ws.iter_rows(values_only=True):
                vals = [cell(v) for v in row]
                while vals and vals[-1] == '':
                    vals.pop()
                if not vals:
                    continue
                width = max(width, len(vals))
                n += 1
                w.writerow(vals)
        with open(path, 'rb') as fh:
            h = hashlib.sha256(fh.read()).hexdigest()
        manifest['sheets'].append({'title': ws.title, 'rows_including_header': n, 'max_cols': width, 'csv_sha256': h})
        print(ws.title, n, width, round(time.time() - t0, 1), flush=True)
    with open(os.path.join(outdir, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
