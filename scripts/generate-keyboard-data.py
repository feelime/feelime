#!/usr/bin/env python3
"""Generate the displayed key map and the variant table for every shipped
double-pinyin scheme (ziranma / flypy / sogou).

- Key map: derived from each schema's speller algebra (same rules the deployer
  compiles into the prism), so the rendered chart cannot drift from the engine.
- Variant table: parsed from the shipped prism.txt spelling set, the exact
  source scripts/verify/guard_dp_finals.js checks against.

Use --check in verification; default writes the generated section in keyboard.js.
No dictionary download or native build is needed.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = {
    'ziranma': 'ziranma_double_pinyin',
    'flypy': 'double_pinyin_flypy',
    'sogou': 'double_pinyin_sogou',
    'ziguang': 'double_pinyin_ziguang',
}
RIME_DIR = ROOT / 'app/src/main/assets/engine-data/rime'
KEYBOARD = ROOT / 'app/src/main/assets/keyboard/keyboard.js'
# The key map chart lives in the settings app (APK asset - the hot-updatable
# keyboard package whitelist only serves index/keyboard.js/css/VERSION).
SETTINGS_DATA = ROOT / 'app/src/main/assets/settings/dp-data.js'
# Custom-phrase spelling variants (issue #17): every pinyin syllable mapped to
# the union of its full spelling and every double-pinyin spelling across the
# four schemes. The shell reads this APK asset to expand each phrase item into
# multiple custom_phrase.txt rows, so one item matches in ALL input modes.
PHRASE_CODES = ROOT / 'app/src/main/assets/custom-phrase-codes.json'
FINALS = 'iu ua ia e uan er ue ve ing uai u i o uo un a ong iong iang uang en eng ang an ao ai ei ie iao ui v ou in ian'.split()
# ';' rides the WIDE key (shift slot, left of Z on the keyboard) and carries
# a final only in sogou - first cell of the last row keeps the chart honest
# about where the key actually is.
KEY_ROWS = ['qwertyuiop', 'asdfghjkl', ';zxcvbnm']


def spell(raw, rules):
    states = [raw]
    for rule in rules:
        parts = rule.split('/')
        kind, pattern = parts[:2]
        replacement = parts[2] if len(parts) > 3 else ''
        if kind == 'abbrev':
            continue
        if kind == 'xlit':
            states = [s.translate(str.maketrans(pattern, replacement)) for s in states]
            continue
        replacement = re.sub(r'\$(\d+)', r'\\g<\1>', replacement)
        if kind == 'erase':
            states = [s for s in states if not re.search(pattern, s)]
        elif kind == 'derive':
            states += [re.sub(pattern, replacement, s) for s in list(states) if re.search(pattern, s)]
        elif kind == 'xform':
            states = [re.sub(pattern, replacement, s) for s in states]
        else:
            raise ValueError('Unsupported Rime algebra rule: ' + kind)
        states = list(dict.fromkeys(states))
    return states


def load_rules(schema_path):
    """Quoted rules under speller:algebra, regardless of key order inside the
    speller block (sogou puts alphabet before algebra)."""
    lines = Path(schema_path).read_text().splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith('speller:'))
    block = []
    for line in lines[start + 1:]:
        if line and not line[0].isspace():
            break
        block.append(line)
    text = '\n'.join(block)
    algebra = text.split('algebra:', 1)[1]
    return re.findall(r'- "([^"]+)"', algebra)


def keymap_rows(rules):
    letters = ''.join(KEY_ROWS)
    mapping = {key: [] for key in letters}
    for final in FINALS:
        raw = final if final == 'er' else 'b' + final
        encodings = [s for s in spell(raw, rules) if len(s) == 2]
        if not encodings:
            raise ValueError('No full spelling for final ' + final)
        targets = {s[-1] for s in encodings}
        if len(targets) != 1:
            raise ValueError(f'Ambiguous final {final}: {targets}')
        target = targets.pop()
        if target not in mapping:
            continue
        mapping[target].append(final)
    initials = {}
    for initial in ['zh', 'ch', 'sh']:
        encodings = spell(initial + 'a', rules)
        initials[encodings[0][0]] = initial
    rows = []
    for keys in KEY_ROWS:
        row = []
        for key in keys:
            finals = mapping[key]
            display = ['ü' if f == 'v' else f for f in finals]
            if key == 'v' and finals == ['ui', 'v']:
                display = ['ui ü']
            # ziguang's N carries ue/ve/ui (ue and ve are spell variants of
            # üe) - fold the trio into one honest cell, same as the v case.
            if key == 'n' and sorted(finals) == ['ue', 'ui', 've']:
                display = ['ui üe']
                finals = ['ui üe']
            if not finals:
                continue  # ';' carries a final only in sogou; row length varies.
            if len(finals) > 2:
                raise ValueError(f'Unsupported display cell {key}: {finals}')
            row.append([key, display[0], display[1] if len(display) > 1 else None,
                        initials.get(key)])
        rows.append(row)
    return rows


def variant_table(prism_id):
    """first key -> sorted second keys, over every 2-key spelling in the
    shipped prism (same derivation as guard_dp_finals.js)."""
    table = {}
    for line in (RIME_DIR / f'{prism_id}.prism.txt').read_text().splitlines():
        spelling = line.split('\t')[0]
        if len(spelling) == 2:
            table.setdefault(spelling[0], set()).add(spelling[1])
    return {k: ''.join(sorted(v)) for k, v in sorted(table.items())}


def phrase_code_table():
    """pinyin syllable -> {"full": [syllable], "<scheme>": [keys...]} (issues
    #17/#29-5 custom-phrase expansion). Read straight from each scheme's
    prism.txt - the exact mapping the device compiles - keeping only
    complete spellings (column 3 == '-'): abbreviated/typo shapes (a -> ang)
    would collide with other syllables' key sequences. Scheme grouping is
    REQUIRED for multi-syllable codes: a per-syllable union cannot be
    concatenated (fg+mb mixes schemes into a spelling nobody types). The
    canonical syllable set is the full-pinyin prism's SECOND column."""
    syllables = set()
    for line in (RIME_DIR / 'luna_pinyin.prism.txt').read_text().splitlines():
        parts = line.split('\t')
        if len(parts) >= 2 and parts[1] and re.fullmatch(r'[a-z]+', parts[1]):
            syllables.add(parts[1])
    per_scheme = {scheme: {} for scheme in SCHEMAS}
    for scheme, prism_id in SCHEMAS.items():
        for line in (RIME_DIR / f'{prism_id}.prism.txt').read_text().splitlines():
            parts = line.split('\t')
            if len(parts) >= 3 and parts[2] == '-' and parts[1] in syllables:
                per_scheme[scheme].setdefault(parts[1], set()).add(parts[0])
    table = {}
    for syllable in sorted(syllables):
        entry = {'full': [syllable]}
        for scheme, mapping in per_scheme.items():
            if syllable in mapping:
                entry[scheme] = sorted(mapping[syllable])
        table[syllable] = entry
    return table


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    maps = {}
    tables = {}
    rules_by_scheme = {}
    digests = []
    for scheme, prism_id in SCHEMAS.items():
        rules = load_rules(RIME_DIR / f'{prism_id}.schema.yaml')
        rules_by_scheme[scheme] = rules
        maps[scheme] = keymap_rows(rules)
        tables[scheme] = variant_table(prism_id)
        digests.append(f'{scheme}={hashlib.sha256((RIME_DIR / (prism_id + ".schema.yaml")).read_bytes()).hexdigest()[:16]}')
    phrase_codes = phrase_code_table()
    generated = ('    // BEGIN GENERATED SCHEMA_MAP\n    // schema-sha256: '
                 + ' '.join(digests) + '\n')
    generated += ('    const DP_INITIAL_FINALS = '
                  + json.dumps(tables, ensure_ascii=False, separators=(',', ':')) + ';\n')
    generated += '    // END GENERATED SCHEMA_MAP'
    settings_data = (
        '// Generated by scripts/generate-keyboard-data.py from the shipped\n'
        '// double-pinyin schemas (schema-sha256: ' + ' '.join(digests) + ').\n'
        '// Displayed key map per scheme; consumed by the settings page only.\n'
        'window.FeelimeDp = '
        + json.dumps({'schemes': list(SCHEMAS), 'maps': maps},
                     ensure_ascii=False, separators=(',', ':')) + ';\n')
    phrase_codes_text = (
        json.dumps(phrase_codes, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n')
    source = KEYBOARD.read_text()
    pattern = r'    // BEGIN GENERATED SCHEMA_MAP[\s\S]*?    // END GENERATED SCHEMA_MAP'
    if not re.search(pattern, source):
        raise SystemExit('Generated section missing in keyboard.js')
    expected = re.sub(pattern, lambda _: generated, source)
    if args.check:
        bad = source != expected
        # A missing file must fail the gate too (a dropped or never-committed
        # dp-data.js would otherwise blank the settings key map silently).
        if not SETTINGS_DATA.exists() or SETTINGS_DATA.read_text() != settings_data:
            bad = True
        if not PHRASE_CODES.exists() or PHRASE_CODES.read_text() != phrase_codes_text:
            bad = True
        if bad:
            raise SystemExit('Key map differs from schema. Run scripts/generate-keyboard-data.py')
        print('Displayed key map matches the shipped schemas.')
    else:
        KEYBOARD.write_text(expected)
        SETTINGS_DATA.write_text(settings_data)
        PHRASE_CODES.write_text(phrase_codes_text)


if __name__ == '__main__':
    main()
