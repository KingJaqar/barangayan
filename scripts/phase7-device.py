"""Controls for the available Android test emulator; no app data resets."""
import json, os, pathlib, re, subprocess, sys, time, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
root = pathlib.Path(__file__).resolve().parents[1]
adb = pathlib.Path('C:/Users/User/AppData/Local/Android/Sdk/platform-tools/adb.exe')
device = os.environ.get('BARANGAYAN_TEST_DEVICE', 'emulator-5554')
assert device in ['emulator-5554', 'emulator-5578']
output = root / 'plans/evidence/phase7/android'
output.mkdir(parents=True, exist_ok=True)
def run(*args):
    return subprocess.run([str(adb), '-s', device, *args], capture_output=True, text=True, check=True, timeout=30).stdout
def inspect():
    run('shell', 'uiautomator', 'dump', '/sdcard/phase7.xml')
    target = root / 'dist/phase7-tools/native-ui.xml'
    run('pull', '/sdcard/phase7.xml', str(target))
    return ET.parse(target).getroot().findall('.//node')
def visible(n):
    a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
    return c>a and d>b
mode=sys.argv[1]
if mode=='inspect':
    print(json.dumps([{k:n.get(k) for k in ['text','content-desc','class','bounds','clickable']} for n in inspect() if n.get('text') or n.get('content-desc') or n.get('class')=='android.widget.EditText'],ensure_ascii=False))
elif mode=='open':
    assert sys.argv[2]=='/login' or sys.argv[2].startswith('/health')
    host=os.environ.get('BARANGAYAN_PREVIEW_HOST','127.0.0.1')
    assert re.fullmatch(r'127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}',host)
    print(run('shell','am','start','-a','android.intent.action.VIEW','-d','exp://'+host+':8087/--'+sys.argv[2]))
elif mode in ['tap','press','fill']:
    label=sys.argv[2]
    nodes=[n for n in inspect() if visible(n) and label in [n.get('text'),n.get('content-desc'),n.get('hint')]]
    assert nodes, 'No observed control: '+label
    nodes.sort(key=lambda n:(n.get('class')=='android.widget.EditText' if mode=='fill' else n.get('clickable')=='true'),reverse=True)
    n=nodes[0];a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
    x,y=str((a+c)//2),str((b+d)//2)
    if mode=='press':run('shell','input','swipe',x,y,x,y,'250')
    else:run('shell','input','tap',x,y)
    if mode=='fill':
        fixture=json.loads((root/'dist/phase7-tools/fixtures.json').read_text())['users']['resident']
        value=fixture['email' if label=='you@example.com' else 'password']
        run('shell','input','keyevent','123');run('shell','input','keyevent',*(['67']*min(100,len(n.get('text','')))))
        for i in range(0,len(value),4):
            run('shell','input','text',value[i:i+4]);time.sleep(.1)
        run('shell','input','keyevent','4')
    print('Operated observed control: '+label)
elif mode=='scroll':
    run('shell','input','swipe','540','1500','540','500','400')
elif mode=='verify':
    name=sys.argv[2];assert re.fullmatch(r'[a-z0-9-]+',name)
    nodes=inspect();labels='\n'.join(n.get('text','')+' '+n.get('content-desc','') for n in nodes)
    assert not re.search(r'priority score|\b\d+ pts\b',labels,re.I),'Native score exposure'
    for expected in sys.argv[3:]:assert expected in labels,'Missing native label: '+expected
    (output/(name+'.xml')).write_bytes((root/'dist/phase7-tools/native-ui.xml').read_bytes())
    run('shell','screencap','-p','/sdcard/phase7.png');run('pull','/sdcard/phase7.png',str(output/(name+'.png')))
    (output/(name+'-results.json')).write_text(json.dumps({'passed':True,'device':device,'requiredLabels':sys.argv[3:],'scoreFreeVisibleAndAccessibilityLabels':True},indent=2))
    print('PASS native score privacy and expected labels: '+name)
else:raise ValueError('Unknown operation')
