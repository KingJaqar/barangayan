import fs from 'node:fs';
import path from 'node:path';

const evidence = path.resolve(import.meta.dirname, '../../../../plans/evidence/admin-profile');
const operation = process.argv[2];
if (operation === '--stop' || operation === '--status') {
  const reportFile = path.join(evidence, 'local-staging-results.json');
  if (!fs.existsSync(reportFile)) throw new Error('No local staging run has been created.');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  if (operation === '--status') {
    console.log(JSON.stringify({ status: report.status, staging: report.staging, checks: report.checks.length, consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length }, null, 2));
  } else {
    if (report.status !== 'staging-ready' || !/^local-staging-[a-f0-9]{10}\.stop$/.test(report.staging?.releaseFile ?? '')) throw new Error('Local staging is not ready or its stop marker is invalid.');
    fs.writeFileSync(path.join(evidence, report.staging.releaseFile), 'Stop requested.\n', { flag: 'wx' });
    console.log('Local staging shutdown requested. Its isolated database is preserved.');
  }
} else {
  if (operation) throw new Error('Use no argument to start, --status to inspect, or --stop to stop local staging.');
  const reportFile = path.join(evidence, 'local-staging-results.json');
  if (fs.existsSync(reportFile)) {
    const previous = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (previous.status === 'staging-ready' && Date.parse(previous.staging?.expiresAt ?? '') > Date.now()) throw new Error('A local staging session is already active. Stop it before starting another.');
  }
  process.env.PROFILE_LOCAL_STAGING = 'true';
  process.env.PROFILE_TEST_CONFIRMATIONS = 'single';
  process.env.PROFILE_TEST_BROWSER = 'chrome';
  await import('./e2e.mjs');
}
