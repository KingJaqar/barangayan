/* Local component acceptance: synthetic data only, never calls a payment provider. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..'), output=path.join(root,'dist/document-flow-work');
(async()=>{
  const aliases = ['next/link','@/hooks/use-paymongo-source','@/hooks/use-scoped-read','@/lib/supabase/client'];
  const fixtures=path.join(root,'scripts/fixtures/document-payment-flow');
  fs.mkdirSync(output,{recursive:true});
  const app=path.join(root,'apps/resident-web');
  const alias={...Object.fromEntries(aliases.map(name=>[name,path.join(fixtures,'browser-mocks.tsx')])),react:path.dirname(require.resolve('react/package.json',{paths:[app]})),'react-dom':path.dirname(require.resolve('react-dom/package.json',{paths:[app]}))};
  await esbuild.build({entryPoints:[path.join(fixtures,'browser-fixture.tsx')],bundle:true,outfile:path.join(output,'fixture.js'),format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_QRPH_SETTLEMENT_READY':'"true"'},alias,tsconfig:path.join(app,'tsconfig.json')});
  const globals=path.join(app,'src/app/globals.css');
  const css=(await postcss([tailwind({base:app})]).process(fs.readFileSync(globals,'utf8'),{from:globals})).css;
  const server=http.createServer((req,res)=>{
    if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
    res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');
    res.end(req.url==='/fixture.js'?fs.readFileSync(path.join(output,'fixture.js')):'<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true}).catch(error=>{server.close();throw error;});
  const page=await browser.newPage({viewport:{width:1000,height:1000},acceptDownloads:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByText('Payment Method',{exact:true}).waitFor();
    await page.evaluate(()=>window.reset('business'));
    await page.getByText('See Attached Tax Code (depends on the kind of transaction)',{exact:true}).first().waitFor();
    assert.equal(await page.getByRole('button',{name:/Pay with QR PH/}).count(),0);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('link',{name:'View My Requests',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'View My Requests'}).getAttribute('href'),'/services/requests');
    assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.name==='start_pickup_payment').length),1);
    await page.screenshot({path:path.join(output,'business-pickup.png'),fullPage:true});
    await page.evaluate(()=>window.reset('certified_true_copy'));
    await page.getByRole('spinbutton').fill('6');
    await page.getByRole('button',{name:'Continue to payment methods'}).click();
    await page.getByRole('button',{name:/Pay with QR PH/}).waitFor();
    assert.equal(await page.evaluate(()=>window.request.assessed_amount_centavos),6000);
    await page.evaluate(()=>window.reset('indigency'));
    await page.getByRole('button',{name:/Pay with QR PH/}).click();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByAltText('PayMongo QR PH code').waitFor();
    await page.evaluate(()=>window.pay());
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(1300);
    assert.equal(await page.getByRole('heading',{name:'Payment Successful',exact:true}).count(),0);
    await page.getByRole('button',{name:'OK',exact:true}).click();
    await page.getByRole('heading',{name:'Payment Successful',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Track My Request',exact:true}).getAttribute('href'),'/services/requests/00000000-0000-4000-8000-000000000125');
    assert.equal(await page.getByRole('link',{name:'Return to Home'}).getAttribute('href'),'/home');
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download Receipt'}).click();
    const receipt=await download;
    await receipt.saveAs(path.join(output,'verified-receipt.pdf'));
    const pdf=fs.readFileSync(path.join(output,'verified-receipt.pdf'),'utf8');
    assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.includes('REQ-2026-00125'));assert.ok(pdf.includes('PHP 100.00'));
    await page.screenshot({path:path.join(output,'payment-success.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: business pickup only, pickup navigation, page-count pricing, QR waits for OK, request-specific tracking, receipt PDF download, home navigation.');
  } catch(error) {
    console.error('Browser errors:',errors);
    console.error('Page text:',await page.locator('body').innerText());
    throw error;
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
