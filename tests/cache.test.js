import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { AssetCache,ASSET_CACHE,sha256 } from '../src/asset-cache.js';
class Storage{
  constructor(){this.buckets=new Map();}
  async has(name){return this.buckets.has(name);}
  async open(name){if(!this.buckets.has(name))this.buckets.set(name,new Map());const map=this.buckets.get(name);return {match:async key=>map.get(key)?.clone(),put:async(key,response)=>map.set(key,response.clone()),delete:async key=>map.delete(key)};}
}
const bytes=new TextEncoder().encode('accurate geometry and original normals\n'.repeat(4000));
const spec={url:'https://assets.test/drone.glb',name:'Drone',kind:'model',sha256:await sha256(bytes.buffer)};
test('invoke browser fetch with its required global receiver',async()=>{
  const cache=new AssetCache({storage:new Storage(),optimizer:async buffer=>buffer,fetcher:async function(){assert.equal(this,globalThis);return new Response(bytes);}});
  assert.deepEqual(new Uint8Array((await cache.get(spec)).buffer),bytes);
});
test('compress cached assets losslessly and reuse them after reload without network',async()=>{
  const storage=new Storage();let requests=0;
  const first=new AssetCache({storage,fetcher:async()=>{requests++;return new Response(bytes);},optimizer:async buffer=>buffer});
  const original=await first.get(spec);assert.ok(original.storedBytes<original.originalBytes/10);
  const cache=await storage.open(ASSET_CACHE),response=await cache.match(spec.url);assert.equal(response.headers.get('x-dronesim-encoding'),'gzip');assert.deepEqual(new Uint8Array(gunzipSync(Buffer.from(await response.arrayBuffer()))),bytes);
  const reloaded=new AssetCache({storage,fetcher:async()=>{throw new Error('Network unavailable');}}),result=await reloaded.get(spec);assert.equal(result.cached,true);assert.deepEqual(new Uint8Array(result.buffer),bytes);assert.equal(requests,1);
});
test('retry downloads only failed preload assets',async()=>{
  const storage=new Storage(),requests=new Map();let fail=true;
  const cache=new AssetCache({storage,optimizer:async b=>b,fetcher:async url=>{requests.set(url,(requests.get(url)||0)+1);if(url.endsWith('second')&&fail)throw new Error('Connection lost');return new Response(bytes);}});
  const specs=[spec,{...spec,name:'Second',url:'https://assets.test/second'}],progress=[];
  await assert.rejects(()=>cache.preload(specs,p=>progress.push(p)),/Connection lost/);fail=false;const result=await cache.preload(specs,p=>progress.push(p));
  assert.equal(requests.get(spec.url),1);assert.equal(requests.get(specs[1].url),2);assert.equal(result.cached,1);assert.equal(progress.at(-1).fraction,1);assert.ok(progress.every(p=>p.fraction>=0&&p.fraction<=1));
});
test('migrate existing downloads without downloading them again',async()=>{
  const storage=new Storage();await(await storage.open('dronesim-models-v1')).put(spec.url,new Response(bytes));
  const cache=new AssetCache({storage,optimizer:async b=>b,fetcher:async()=>{throw new Error('Unexpected download');}});const result=await cache.get(spec);assert.equal(result.cached,true);assert.deepEqual(new Uint8Array(result.buffer),bytes);assert.ok(await(await storage.open(ASSET_CACHE)).match(spec.url));
});
test('reject damaged models before caching them',async()=>{
  const storage=new Storage(),cache=new AssetCache({storage,optimizer:async b=>b,fetcher:async()=>new Response('damaged')});await assert.rejects(()=>cache.get(spec),/integrity/);assert.equal(await(await storage.open(ASSET_CACHE)).match(spec.url),undefined);
});
test('keep a working session cache if persistent browser storage fails',async()=>{
  let requests=0;const cache=new AssetCache({storage:{open:async()=>{throw new Error('Storage full');},has:async()=>false},optimizer:async b=>b,fetcher:async()=>{requests++;return new Response(bytes);}});
  await cache.get(spec);const second=await cache.get(spec);assert.equal(requests,1);assert.equal(second.cached,true);assert.equal(cache.cacheAvailable,false);
});
