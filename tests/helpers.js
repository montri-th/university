/** Shared loaders for the node tests (data files are read once per process). */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {decodeDataset, setProvinces} from '../js/model.js';
import {buildAreaIndex} from '../js/areas.js';
import {decodeCampus} from '../js/campus.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
export const readJSON = path => { if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(ROOT, path), 'utf8'))); return cache.get(path); };
export const readBytes = path => readFileSync(join(ROOT, path));
export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

let loaded = null;
/** The shipped data set, decoded exactly as the browser does (the campus file too). */
export function load() {
  if (!loaded) {
    const indexJSON = readJSON('data/area-index.json'), provincesGeo = readJSON('data/provinces.geojson');
    setProvinces(indexJSON.provinces);
    const index = buildAreaIndex(indexJSON);
    const raw = readJSON('data/universities.json');
    const data = decodeDataset(raw, index);
    const campusRaw = readJSON('data/campus.json');
    const campus = decodeCampus(campusRaw);
    loaded = {raw, data, index, indexJSON, provincesGeo, campusRaw, campus};
  }
  return loaded;
}
