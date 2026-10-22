"""Reuse hash-verified Phase 3 acceptance harnesses against the new Phase 4 DB."""
import hashlib, json, pathlib
root=pathlib.Path.cwd(); work=root/'tmp/family-web-phase4-20261022'
audit=root/'plans/evidence/family-web-qr-attendance/phase-3-2026-10-22'
out=root/'plans/evidence/family-web-qr-attendance/phase-4-2026-10-22'
out.mkdir(exist_ok=True)
manifest=json.loads((audit/'harness/manifest.json').read_text())
selected={'browser.mjs','browser-client.ts','browser-fixture.tsx','browser-db.py','boundary.mjs','visual.mjs','reset.sql'}
ledger=[]
for item in manifest:
    path=root/item['original']
    if path.name not in selected: continue
    data=path.read_bytes()
    assert hashlib.sha256(data).hexdigest()==item['sha256'],str(path)
    assert (audit/item['audit_copy']).read_bytes()==data
    text=data.decode('utf-8').replace('\r\n','\n').replace('family-web-phase3-20261022','family-web-phase4-20261022').replace('phase-3-2026-10-22','phase-4-2026-10-22').replace('family_attendance_restore0139_20261022','family_attendance_web4_20261022').replace('family-web-phase3-rest','family-web-phase4-rest')
    if path.name=='browser-db.py':
        text=text.replace("print('Isolated PostgREST v14.5 started on loopback 55503; synthetic local fixtures inserted.')","print('Isolated synthetic PostgREST started on loopback port '+port)")
        text=text.replace("r=subprocess.run(['node',", "if len(sys.argv)>2 and sys.argv[2]=='admin': env['ATTENDANCE_TEST_TOKEN']=adminToken\n r=subprocess.run(['node',")
    target=work/path.name; target.write_text(text,encoding='utf-8')
    ledger.append({'source':path.relative_to(root).as_posix(),'source_sha256':item['sha256'],'target':target.relative_to(root).as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'changes':'Only phase/work/output/database/container identifiers; setup prints observed dynamic port.'})
(work/'browser-reuse.json').write_text(json.dumps(ledger,indent=2))
for original,target in [('browser.mjs','admin.mjs'),('browser-fixture.tsx','admin-fixture.tsx'),('browser-client.ts','admin-client.ts')]:
    path=root/'tmp/family-web-phase2-20261021'/original
    text=path.read_text(encoding='utf-8').replace('family-web-phase2-20261021','family-web-phase4-20261022').replace('phase-2-2026-10-21','phase-4-2026-10-22/admin').replace('browser-fixture.tsx','admin-fixture.tsx').replace('browser-client.ts','admin-client.ts')
    text=text.replace("'http://127.0.0.1:55499/'", "`http://127.0.0.1:${fs.readFileSync(path.join(work,'rest-port.txt'),'utf8').trim()}/`")
    (work/target).write_text(text,encoding='utf-8')
(out/'admin').mkdir(exist_ok=True)
print('Verified and adapted',len(ledger),'existing harness inputs; all originals preserved.')
