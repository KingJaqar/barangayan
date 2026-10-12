const fs = require('node:fs');
for (const [dir, file] of [['incident-reports', 'incident-table'], ['health', 'drive-table'], ['health/applicants', 'applicants-table']]) {
  const path = `apps/admin-web/src/app/(admin)/${dir}/${file}.tsx`;
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace('const detail = useProfileTableDetail', 'const { selected: selectedDetail, status: detailStatus, open: openDetail, close: closeDetail, retry: retryDetail, containerRef } = useProfileTableDetail');
  for (const [old, next] of Object.entries({ 'detail.selected': 'selectedDetail', 'detail.status': 'detailStatus', 'detail.open': 'openDetail', 'detail.close': 'closeDetail', 'detail.retry': 'retryDetail', 'detail.containerRef': 'containerRef' })) code = code.replaceAll(old, next);
  fs.writeFileSync(path, code);
}
