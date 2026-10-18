// Real web payment components under Strict Mode; synthetic replies, no provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const output = path.resolve(app, '../../dist/qrph-setup');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
  '@/components/theme/theme-controller': `export const useThemeController=()=>({theme:'light'});`,
  '@/lib/supabase/client': `
    const client={rpc:async()=>{fx.methodCalls++;return{error:null}},functions:{async invoke(name,{body}){
      if(name==='check-payment-status')return{data:{status:'pending'},error:null};
      if(name==='cancel-payment')return{data:{status:'cancelled'},error:null};
      fx.calls.push(body.requestId);
      if(fx.mode==='delayed')await new Promise(resolve=>fx.release=resolve);
      if(fx.mode==='network')throw new TypeError('Synthetic connection loss');
      if(fx.mode==='preparing'||fx.mode==='forever')return{data:{status:'preparing'},error:null};
      return{data:{paymentId:'payment-'+body.requestId,paymentIntentId:'pi-'+body.requestId,qrImageUrl:fx.png,expiresAt:Date.now()+1800000,documentFeeCentavos:10000,amountCentavos:10000},error:null};
    }},channel(){const c={on(){return c},subscribe(){return c}};return c},removeChannel(){}};
    export const createSupabaseBrowserClient=()=>client;`,
};
const entry = `
import React,{StrictMode,useState}from'react';import{createRoot}from'react-dom/client';
import{PaymentMethodStep}from'@/components/services/document-request-modal/payment-method-step';
import{QrphStep}from'@/components/services/document-request-modal/qrph-step';
import{Toaster}from'@/components/ui/sonner';import{setNotificationSession}from'@/lib/notify';
setNotificationSession('fixture-owner');
function Fixture(){const[step,setStep]=useState(fx.direct?'qr':'method'),[id,setId]=useState('request');fx.close=()=>setStep('closed');fx.changeRequest=()=>setId('replacement');
const common={requestId:id,referenceNumber:'REQ-FIXTURE',documentName:'Certificate of Indigency',feeCentavos:10000};
return <><main>{step==='method'?<PaymentMethodStep {...common} onMethodChosen={()=>setStep('qr')}/>:step==='qr'?<QrphStep {...common} documentFeeCentavos={10000} onPaid={()=>{}} onCancelled={()=>setStep('closed')} onBack={()=>setStep('method')}/>:null}</main><Toaster/></>}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture/></StrictMode>);`;
const bundle = await build({ stdin: { contents: entry, resolveDir: app, loader: 'jsx' }, bundle: true, write: false, jsx: 'automatic',
  tsconfig: path.join(app, 'tsconfig.json'),
  alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_QRPH_SETTLEMENT_READY': '"true"' },
  plugins: [{ name: 'payment-fixture', setup(builder) {
    builder.onResolve({ filter: /^(next\/|@\/)/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: app }));
  } }],
});
let browser;
const checks = [];
const errors = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  async function open(mode = 'ready', direct = true, useClock = false) {
    await page.goto('about:blank');
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
    if (useClock) await page.clock.install();
    await page.evaluate(({mode,direct}) => { window.fx = {mode,direct,calls:[],methodCalls:0,png:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a00kAAAAASUVORK5CYII='}; }, {mode,direct});
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
  }
  await open('ready', false);
  await page.getByRole('button', { name: /Pay with QR PH/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByAltText('PayMongo QR PH code').waitFor();
  assert.equal(await page.evaluate(() => fx.methodCalls), 1);
  assert.deepEqual(await page.evaluate(() => fx.calls), ['request']);
  checks.push('Choosing QR PH shows the QR with exactly one setup call under Strict Mode');

  await open('preparing');
  await page.waitForFunction(() => fx.calls.length === 1);
  assert.equal(await page.getByAltText('PayMongo QR PH code').count(), 0);
  assert.equal(await page.locator('[data-sonner-toast]').count(), 0);
  await page.evaluate(() => fx.mode = 'ready');
  await page.getByAltText('PayMongo QR PH code').waitFor();
  assert.deepEqual(await page.evaluate(() => fx.calls), ['request', 'request']);
  checks.push('An existing reservation stays loading then resumes the winning QR');

  await open('preparing');
  await page.waitForFunction(() => fx.calls.length === 1);
  await page.evaluate(() => fx.close());
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => fx.calls.length), 1);
  checks.push('Closing the payment screen cancels scheduled setup checks');

  await open('delayed');
  await page.waitForFunction(() => typeof fx.release === 'function');
  await page.evaluate(() => { const old = fx.release; fx.mode = 'ready'; fx.changeRequest(); fx.oldRelease = old; });
  await page.getByAltText('PayMongo QR PH code').waitFor();
  await page.evaluate(() => fx.oldRelease());
  assert.deepEqual(await page.evaluate(() => fx.calls), ['request', 'replacement']);
  await page.getByText('Transaction ref: pi-replacement', { exact: true }).waitFor();
  checks.push('A late response from an old request cannot replace the current QR');

  await open('network');
  await page.getByText("We couldn't confirm the payment setup. Check your request before starting another payment.", { exact: true }).waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => fx.calls.length), 1);
  checks.push('Connection loss shows an uncertain outcome without starting another charge');

  await open('forever', true, true);
  await page.waitForFunction(() => fx.calls.length === 1);
  for (let i = 0; i < 30; i++) await page.clock.runFor(1000);
  await page.getByText('Your QR payment is still being prepared. Reopen this request to check it before starting another payment.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => fx.calls.length), 30);
  await page.clock.runFor(10000);
  assert.equal(await page.evaluate(() => fx.calls.length), 30);
  checks.push('A slow reservation stops checking after 30 attempts with persistent recovery guidance');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser?.close();
}
