/* Actual Android form and toast, rendered through react-native-web with synthetic accounts. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),app=path.join(root,'apps/resident-android-mobile'),fixtures=path.join(root,'scripts/fixtures/document-request-form'),output=path.join(root,'dist/document-flow-work');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const mocks=['@/hooks/use-profile','@/hooks/use-theme','@/hooks/use-font-preference','@/constants/fonts','@/constants/theme','@/lib/supabase','@/lib/supporting-upload','@expo/vector-icons','expo-router','expo-image','react-native-safe-area-context'];
  const alias={...Object.fromEntries(mocks.map(name=>[name,path.join(fixtures,'browser-mocks.tsx')])),'react-native':require.resolve('react-native-web'),react:path.dirname(require.resolve('react/package.json',{paths:[app]})),'react-dom':path.dirname(require.resolve('react-dom/package.json',{paths:[app]}))};
  await esbuild.build({entryPoints:[path.join(fixtures,'browser-fixture.tsx')],bundle:true,outfile:path.join(output,'request-form.js'),format:'iife',jsx:'automatic',alias,tsconfig:path.join(app,'tsconfig.json'),define:{'process.env.NODE_ENV':'"development"',__DEV__:'true',global:'window'}});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?fs.readFileSync(path.join(output,'request-form.js')):'<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}#root{display:flex;max-width:430px;margin:auto}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true}).catch(error=>{server.close();throw error;});
  const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const submit=()=>page.getByText('Submit request',{exact:true}).click();
  const reset=async(role='resident')=>{await page.evaluate(role=>window.reset(role),role);await page.getByLabel('Approved ID front').waitFor();await page.waitForFunction(()=>!document.body.innerText.includes('Checking verification'));};
  const purpose=async()=>{await page.getByText('Choose a purpose',{exact:true}).click();await page.getByRole('button',{name:'Medical assistance',exact:true}).click();await page.getByRole('button',{name:'Medical assistance',exact:true}).waitFor({state:'hidden'});};
  const appearance=()=>page.getByRole('switch',{name:'I understand personal appearance at the Barangay Hall is required'}).click();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel('Approved ID front').waitFor();
    await page.getByText('Choose HOA certification',{exact:true}).click();
    await submit();
    await page.getByRole('alert').filter({hasText:'Choose a purpose for your request.'}).waitFor();
    assert.equal(await page.evaluate(()=>window.uploads),0,'Invalid forms must not upload files');
    assert.equal(await page.evaluate(()=>window.calls.length),0,'Invalid forms must not submit requests');
    assert.equal(await page.getByText('Confirm that you understand personal appearance at the Barangay Hall is required.',{exact:true}).count(),1);
    await page.screenshot({path:path.join(output,'request-form-required.png'),fullPage:true});
    await purpose();await appearance();await submit();
    await page.waitForFunction(()=>window.navigation?.startsWith('/services/payment/'));
    assert.equal(await page.evaluate(()=>window.uploads),1);
    assert.equal(await page.evaluate(()=>window.calls.length),1);
    await reset();await purpose();await appearance();
    await page.getByRole('switch',{name:'I am a renter'}).click();await submit();
    await page.getByRole('alert').filter({hasText:'Upload the lessor endorsement required for renters.'}).waitFor();
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await page.getByText('Choose Lessor endorsement',{exact:true}).click();await submit();
    await page.waitForFunction(()=>window.navigation?.startsWith('/services/payment/'));
    assert.equal(await page.evaluate(()=>window.calls[0].args.p_input.attachments[0].requirementCode),'lessor');
    await reset('admin');await submit();
    await page.getByRole('alert').filter({hasText:'administrator account'}).waitFor();
    assert.equal(await page.evaluate(()=>window.uploads+window.calls.length),0);
    await reset();await purpose();await appearance();
    await page.evaluate(()=>window.rpcError={code:'42501',message:'forbidden'});await submit();
    await page.getByRole('alert').filter({hasText:'active resident account'}).waitFor();
    assert.equal((await page.locator('body').innerText()).includes('forbidden'),false);
    await reset();await purpose();await appearance();await page.getByText('Choose HOA certification',{exact:true}).click();
    await page.evaluate(()=>window.uploadError={statusCode:'403',message:'new row violates row-level security policy'});await submit();
    await page.getByRole('alert').filter({hasText:'cannot upload request attachments'}).waitFor();
    assert.equal((await page.locator('body').innerText()).includes('row-level security'),false);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    assert.equal(await page.getByText('certification.pdf',{exact:true}).count(),1,'Failed upload keeps the selected file');
    await page.screenshot({path:path.join(output,'request-form-permission-toast.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: required fields highlighted before uploads, corrected resident submission, conditional renter certification, optional HOA, admin guard, safe permission toasts and retained files.');
  }catch(error){console.error('Browser errors:',errors);console.error(await page.locator('body').innerText());throw error;}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
