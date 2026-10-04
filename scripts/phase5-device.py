"""ADB controls and evidence for the isolated Phase 5 emulator."""
import json
import pathlib
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

root = pathlib.Path(__file__).resolve().parents[1]
adb = pathlib.Path('C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe')
def run(*args):
    return subprocess.run([str(adb), '-s', 'emulator-5556', *args], capture_output=True, text=True, check=True).stdout
def inspect():
    run('shell', 'uiautomator', 'dump', '/sdcard/phase5.xml')
    target = root / 'dist/phase5-tools/device-ui.xml'
    run('pull', '/sdcard/phase5.xml', str(target))
    return ET.parse(target).getroot().findall('.//node')

def visible(node):
    left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
    return right > left and bottom > top and top < 2400 and bottom > 100
mode = sys.argv[1]
if mode == 'inspect':
    print(json.dumps([{key: node.get(key) for key in ['text', 'content-desc', 'class', 'bounds', 'checked', 'focused', 'enabled']} for node in inspect() if node.get('text') or node.get('content-desc') or node.get('class') == 'android.widget.EditText'], ensure_ascii=False))
elif mode == 'verify':
    assert sys.argv[2].replace('-', '').isalnum()
    labels = [node.get('text') for node in inspect() if visible(node)]
    for expected in sys.argv[3:]:
        assert expected in labels, 'Native display mismatch: ' + expected
    source = root / 'dist/phase5-tools/device-ui.xml'
    (root / ('plans/evidence/phase5/android-' + sys.argv[2] + '.xml')).write_bytes(source.read_bytes())
    print('PASS native display: ' + ', '.join(sys.argv[3:]))
elif mode in ['tap', 'fill', 'tap-find', 'fill-find', 'activate']:
    label = sys.argv[2]
    matches = []
    for attempt in range(8 if mode.endswith('-find') else 1):
        matches = [node for node in inspect() if visible(node) and label in [node.get('text'), node.get('content-desc'), node.get('hint')]]
        if matches:
            break
        run('shell', 'input', 'swipe', '540', '1900', '540', '650', '400')
    assert matches, 'Visible control not found: ' + label
    matches.sort(key=lambda node: (node.get('class') == 'android.widget.EditText' if mode.startswith('fill') else node.get('content-desc') == label, node.get('clickable') == 'true'), reverse=True)
    node = matches[0]
    left, top, right, bottom = map(int, node.get('bounds').replace('][', ',').strip('[]').split(','))
    run('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
    if mode == 'activate':
        run('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
    if mode.startswith('fill'):
        run('shell', 'input', 'keyevent', '123')
        run('shell', 'input', 'keyevent', *(['67'] * max(1, min(len(node.get('text', '')), 1000))))
        # Controlled React Native inputs need the previous edit committed before
        # the next batch; Android input's unpaced bulk events can drop characters.
        for offset in range(0, len(sys.argv[3]), 4):
            run('shell', 'input', 'text', shlex.quote(sys.argv[3][offset:offset + 4].replace(' ', '%s')))
            time.sleep(0.15)
    print('Operated visible control: ' + label)
elif mode == 'scroll':
    run('shell', 'input', 'swipe', '540', '1900' if sys.argv[2] == 'down' else '600', '540', '600' if sys.argv[2] == 'down' else '1900', '400')
    print('Scrolled ' + sys.argv[2])
elif mode == 'screen':
    assert sys.argv[2].replace('-', '').isalnum()
    run('shell', 'screencap', '-p', '/sdcard/phase5.png')
    target = root / ('plans/evidence/phase5/android-' + sys.argv[2] + '.png')
    run('pull', '/sdcard/phase5.png', str(target))
    print(str(target))
elif mode == 'open':
    assert sys.argv[2].startswith('/services') or sys.argv[2].startswith('/settings') or sys.argv[2] == '/login'
    print(run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', shlex.quote('exp://10.0.2.2:8082/--' + sys.argv[2])))
elif mode == 'back':
    run('shell', 'input', 'keyevent', '4')
else:
    raise ValueError('Unknown isolated device operation')
