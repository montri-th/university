#!/usr/bin/env python3
"""Build the metric-tile pictogram subset of Material Symbols Rounded (Apache 2.0).

Static instance at the LDS axes for this family (FILL 0, wght 300, GRAD 0, opsz 24),
subset to the pictogram glyphs below, written as WOFF2 next to the approved nav-7
subset (which stays byte-identical). The source variable font is not committed;
pass its path. Requires fonttools + brotli.

  python3 scripts/build-pictogram-font.py "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf"

Pictogram roles (test exception approved by the owner 2026-10-22 for the CityMETER
demos, to be folded into LDS if it proves itself): area = map, province =
location_city, segment = category, venue = local_mall; Fitness 0.3.0 added ai =
auto_awesome, streetview, maps = location_on, building = apartment (owner
2026-10-29: show icons and symbols to keep the panel text short). Hotel 0.1.0
adds hotel (records), rooms = bed, rail = train, meeting = groups, price =
payments, chain = account_tree and compare = compare_arrows. Hotel 0.2.0 adds
sea = waves, elevation = landscape, relief = height and forest (owner 2026-11-01:
icons instead of long text on the map). Hotel 0.3.1 adds rank = leaderboard,
date = event, distance = straighten (straight line), construction and dataset =
database (owner 2026-11-01, “เรื่องภาษา”: symbols, logos, icons and charts keep
the text short). School 0.1.0 replaces the hotel roles (hotel, bed, groups as
meeting rooms, payments as recorded price, account_tree as chain, local_mall)
with school (records), students = groups, teacher = co_present, classroom =
meeting_room, level = stairs, fee = payments, quality = verified, programme =
menu_book, history = trending_up, aff = account_tree (สังกัด) and closed =
event_busy. School 0.2.0 adds learning = auto_stories (เรียนเสริม records) and the
four services tutor = edit_note (กวดวิชา), language = translate (ภาษา), arts =
palette (ศิลปะ) and child = child_care (พัฒนาการเด็ก). No star glyph: a star would read as a rating. Outbound links keep
the nav-7 open_in_new mark.
"""
import hashlib, json, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GLYPHS = {
    'area': ('map', 0xE55B),
    'province': ('location_city', 0xE7F1),
    'segment': ('category', 0xE72C),
    # Fitness 0.3.0 (owner 2026-10-29: icons and symbols instead of long text): contextual actions and the building view.
    'ai': ('auto_awesome', 0xE65F),
    'streetview': ('streetview', 0xE56E),
    'maps': ('location_on', 0xE0C8),
    'building': ('apartment', 0xEA40),
    # School 0.1.0: the two measures and the facts of a school.
    'school': ('school', 0xE80C),
    'students': ('groups', 0xF233),
    'teacher': ('co_present', 0xEAF0),
    'classroom': ('meeting_room', 0xEB4F),
    'level': ('stairs', 0xF1A9),
    'fee': ('payments', 0xEF63),
    'quality': ('verified', 0xEF76),
    'programme': ('menu_book', 0xEA19),
    'history': ('trending_up', 0xE8E5),
    'aff': ('account_tree', 0xE97A),
    'closed': ('event_busy', 0xE615),
    'rail': ('train', 0xE570),
    'compare': ('compare_arrows', 0xE915),
    # Hotel 0.2.0 (owner 2026-11-01: symbols and icons instead of long text, above all on the map): the terrain
    # facts of a place — sea distance, ground elevation, relief within 500 m and tree cover.
    'sea': ('waves', 0xE176),
    'elevation': ('landscape', 0xE564),
    'relief': ('height', 0xEA16),
    'forest': ('forest', 0xEA99),
    # Hotel 0.3.1 (owner 2026-11-01, “เรื่องภาษา … ใช้ symbol, logo, icon, charts มาช่วยทำให้ text กระชับ”): ranks,
    # the date and the dataset of the provenance line, straight-line distances and stations under construction.
    'rank': ('leaderboard', 0xF20C),
    'date': ('event', 0xE878),
    'distance': ('straighten', 0xE41C),
    'construction': ('construction', 0xEA3C),
    'dataset': ('database', 0xF20E),
    # School 0.2.0 (owner 2026-11-06: เรียนเสริมและพัฒนาทักษะ from the same research master): the learning-service
    # records and their four services.
    'learning': ('auto_stories', 0xE666),
    'tutor': ('edit_note', 0xE745),
    'language': ('translate', 0xE8E2),
    'arts': ('palette', 0xE40A),
    'child': ('child_care', 0xEB41),
}
AXES = {'FILL': 0, 'wght': 300, 'GRAD': 0, 'opsz': 24}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons' / 'material-pictogram-300.woff2'
MANIFEST = ROOT / 'assets' / 'icons' / 'material-pictogram-300.json'

def main(src):
    font = TTFont(src)
    static = instancer.instantiateVariableFont(font, AXES, inplace=False, updateFontNames=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = []  # codepoint access only (CSS content), no ligatures needed
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.drop_tables += ['GSUB', 'GPOS']
    sub = subset.Subsetter(options)
    sub.populate(unicodes=[cp for _, cp in GLYPHS.values()])
    sub.subset(static)
    static.flavor = 'woff2'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    static.save(OUT)
    data = OUT.read_bytes()
    check = TTFont(OUT)
    cmap = check.getBestCmap()
    missing = [n for n, (_, cp) in GLYPHS.items() if cp not in cmap]
    if missing:
        raise SystemExit(f'missing glyphs: {missing}')
    manifest = {
        'family': 'LDS Material Symbols Rounded Pictogram',
        'file': OUT.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'source': 'google/material-design-icons variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf',
        'sourceSha256': hashlib.sha256(Path(src).read_bytes()).hexdigest(),
        'license': 'Apache-2.0 (assets/icons/material-symbols-Apache-2.0.txt)',
        'axes': AXES,
        'glyphs': {role: {'name': name, 'codepoint': f'U+{cp:04X}'} for role, (name, cp) in GLYPHS.items()},
        'status': 'test exception to LDS nav-7 (owner 2026-10-22; actions and building added 2026-10-29; terrain glyphs 2026-11-01 for the map labels; rank, date, distance, construction and dataset 2026-11-01 for short copy; school glyphs 2026-11-05; learning glyphs 2026-11-06); nav-7 subset unchanged',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {OUT} ({len(data)} bytes, sha256 {manifest["sha256"]}) and {MANIFEST.name}')
    print('unicode-range:', ', '.join(f'U+{cp:04X}' for _, cp in GLYPHS.values()))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
