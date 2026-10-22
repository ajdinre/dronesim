import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(300000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://dronesim.test/**',async route=>{const file=path.join(root,new URL(route.request().url()).pathname==='/'?'index.html':new URL(route.request().url()).pathname);const contentType=file.endsWith('.js')?'application/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.css')?'text/css':'text/html';await route.fulfill({body:await readFile(file),contentType});});
  const header=Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1024 +X 2048\n'),pixels=Buffer.alloc(2048*1024*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=128;pixels[i+1]=140;pixels[i+2]=160;pixels[i+3]=129;}
  await page.route('https://dl.polyhaven.org/**',route=>route.fulfill({body:Buffer.concat([header,pixels]),contentType:'application/octet-stream',headers:{'access-control-allow-origin':'*'}}));
  await page.goto('http://dronesim.test/');await page.locator('#startup-loader').waitFor({state:'hidden'});
  assert.equal(await page.locator('#startup-progress').getAttribute('value'),'100');
  assert.equal(await page.locator('#viewport .image-controls button').count(),5);
  await page.getByRole('button',{name:'Randomize camera',exact:true}).click();
  assert.ok(Number(await page.locator('#fov').inputValue())>=60);
  assert.equal(await page.locator('#seed-label,.preview-footer,#object-stat,#hdri-resolution').count(),0);
  assert.equal(await page.locator('header').count(),0);
  await page.locator('#camera-height').fill('0.5');await page.locator('#camera-height').dispatchEvent('input');
  await page.getByRole('button',{name:'Objects',exact:true}).click();
  for(const type of ['dji-mini-3','dji-air-2s','dji-mavic-3-cine','dji-mini-3-pro']){await page.locator('#edit-type').selectOption(type);assert.equal(await page.locator('[data-property="size"]').count(),1);assert.equal(await page.locator('[data-property="color"]').count(),1);}
  await page.getByRole('button',{name:'Scene',exact:true}).click();
  for(const value of ['beach','city','forest'])await page.locator('#environment').selectOption(value);
  await page.locator('input[value="dji-air-2s"]').check();await page.locator('#count').fill('2');await page.locator('#count').dispatchEvent('input');
  await page.getByRole('button',{name:'Export dataset',exact:true}).first().click();await page.locator('#batch').fill('2');await page.locator('#resolution').selectOption('640,480');
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('/tmp/dronesim-test.zip');
  await page.locator('#export-status').filter({hasText:'Exported 2 images'}).waitFor();assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/dronesim-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log('browser checks passed');
}finally{await browser.close();}
