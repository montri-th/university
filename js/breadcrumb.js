/**
 * Breadcrumb — ประเทศไทย › จังหวัด, then the campus the reader is inside — the CityMETER production hierarchy, through
 * the shared shell (js/shell/breadcrumb.js, citymeter-shell). The province is this dataset's finest area (the MHESI
 * student file names a province for each reporting unit and no district), so a district link opens its province.
 * A campus site is the last crumb without a production link (demo-platform-review §5.3 rule 4); a university, a
 * reporting unit, a station or a building is the panel heading, never a crumb.
 */
import {provinceByCode} from './model.js';
import {areaWord} from './areas.js';
import {buildBreadcrumb as shellBreadcrumb, renderBreadcrumb, breadcrumbText, deepestHref} from './shell/breadcrumb.js';

/**
 * Production dataset code (`?d=`): '' while the dataset registry names no production code for research.TH.university —
 * the address and the production links then name the place alone (citymeter-shell 0.4.3).
 */
export const DATASET = '';

/** Pure model. province = production code or ''; site = {id, name, province} or null. */
export const buildBreadcrumb = (sel = {}) => shellBreadcrumb(sel, {dataset: DATASET, provinceByCode, areaWord});
export {renderBreadcrumb, breadcrumbText};

/** Production deep link of the deepest administrative crumb (for “ดูใน CityMETER”). */
export const productionHref = crumbs => deepestHref(crumbs, DATASET);
