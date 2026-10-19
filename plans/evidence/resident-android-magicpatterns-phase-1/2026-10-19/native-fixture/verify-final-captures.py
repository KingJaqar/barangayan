from pathlib import Path
import json
import xml.etree.ElementTree as ET
from PIL import Image

base = Path('C:/Users/User/barangayan/plans/evidence/resident-android-magicpatterns-phase-1/2026-10-19')
native = base / 'native-resume'
def nodes(name):
    return list(ET.parse(native / name / 'ui.xml').iter('node'))
def has(name, attribute, value):
    return any(n.get(attribute) == value for n in nodes(name))
checks = []
for mode in ('light', 'dark'):
    opened = 'final-padding-dialog-light-confirmed' if mode == 'light' else 'final-padding-dialog-dark-open'
    closed = f'final-padding-dialog-{mode}-cancelled'
    for label in ('Cancel', 'Delete'):
        checks.append({'check': f'{mode} final {label} action', 'passed': has(opened, 'content-desc', label)})
    checks.append({'check': f'{mode} password gate', 'passed': has(opened, 'text', 'Password')})
    checks.append({'check': f'{mode} cancellation removes confirmation', 'passed': not has(closed, 'content-desc', 'Delete') and has(closed, 'content-desc', 'Open cancel-only dialog')})
for case, label in [(2, 'Fixture 2: light #2563EB georgia'), (3, 'Fixture 3: light #FFFFFF tahoma'), (4, 'Fixture 4: dark #0F6E5B georgia')]:
    checks.append({'check': f'local appearance case {case} confirmed', 'passed': has(f'final-padding-appearance-{case}', 'text', label)})
pngs = list(native.rglob('*.png'))
for png in pngs:
    with Image.open(png) as img:
        img.verify()
xmls = list(native.rglob('ui.xml'))
for xml in xmls:
    ET.parse(xml)
result = {'checks': checks, 'passed': sum(c['passed'] for c in checks), 'total': len(checks), 'pngVerified': len(pngs), 'uiXmlParsed': len(xmls), 'limits': 'Captured-tree/settled visual evidence only; speech, keyboard and measured motion pending at owner instruction. Earlier performance captures precede final styling correction.'}
(base / 'final-reference-verification.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
print(json.dumps(result, indent=2))
if not all(c['passed'] for c in checks):
    raise SystemExit(1)
