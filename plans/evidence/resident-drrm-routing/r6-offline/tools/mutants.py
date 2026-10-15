import subprocess, shutil, sys
src='src/lib/offline-routing.ts'; orig=sys.argv[1]
mutants=[
 ('skip hash check', "(await sha256(text)) !== entry.sha256", "false"),
 ('promote skipped on committed recovery', "      await promote(storage, STORE_FILES.avoidanceNext, STORE_FILES.avoidance);\n      await promote(storage, STORE_FILES.conditionsNext, STORE_FILES.conditions);\n    } else {", "    } else {"),
 ('older conditions accepted', "stored.snapshot.revision > snapshot.revision", "false"),
 ('unresolved avoidance not deferred', "if (remap.unresolvedIds.length > 0) return", "if (false) return"),
 ('remap ignores unresolved', "if (mappings.some(mapping => mapping.status === 'unresolved')) {", "if (false) {"),
 ('activation ignores closure mapping', "if (!selection.ok) return { status: 'deferred', reason: selection.reason, unresolvedAvoidanceIds: [] };", ""),
 ('no staged verification', "if (stagedCheck === null || !stagedCheck.ok) {", "if (stagedCheck === null) {"),
]
for name, a, b in mutants:
    s=open(orig,encoding='utf-8').read()
    assert s.count(a)==1, name
    open(src,'w',encoding='utf-8',newline='').write(s.replace(a,b))
    r=subprocess.run('npx vitest run src/lib/offline-routing.test.ts',shell=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print(('KILLED ' if r.returncode!=0 else 'SURVIVED ')+name, flush=True)
shutil.copy(orig, src)
