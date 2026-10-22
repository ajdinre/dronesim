import { optimizeModel } from './optimize-model.js';
export const ASSET_CACHE='dronesim-assets-v3';
const legacyCaches=['dronesim-models-v1','dronesim-hdri-v1'];
export async function sha256(buffer){const hash=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function unpack(response){const encoding=response.headers.get('x-dronesim-encoding');if(encoding==='gzip')return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return response.arrayBuffer();}

export class AssetCache{
  constructor({storage=globalThis.caches,fetcher=globalThis.fetch,optimizer=optimizeModel}={}){this.storage=storage;this.fetcher=fetcher;this.optimizer=optimizer;this.inflight=new Map();this.memoryFallback=new Map();this.cacheAvailable=true;}
  async open(){try{const cache=await this.storage?.open(ASSET_CACHE);if(!cache)this.cacheAvailable=false;return cache;}catch{this.cacheAvailable=false;return null;}}
  async get(spec,onProgress=()=>{}){
    if(this.memoryFallback.has(spec.url)){const result=this.memoryFallback.get(spec.url);onProgress({loaded:result.buffer.byteLength,total:result.buffer.byteLength,cached:true});return {...result,cached:true};}
    if(this.inflight.has(spec.url))return this.inflight.get(spec.url);
    const promise=this.load(spec,onProgress);this.inflight.set(spec.url,promise);
    try{return await promise;}finally{this.inflight.delete(spec.url);}
  }
  async load(spec,onProgress){
    const cache=await this.open();let cached=await cache?.match(spec.url);
    if(cached){
      try{
        const buffer=await unpack(cached.clone());
        if(cached.headers.get('x-dronesim-source-sha256')!==(spec.sha256||'')||await sha256(buffer)!==cached.headers.get('x-dronesim-sha256'))throw new Error('Cached asset failed verification.');
        const result={buffer,cached:true,originalBytes:Number(cached.headers.get('x-dronesim-original-bytes')),storedBytes:Number(cached.headers.get('x-dronesim-stored-bytes')),optimized:cached.headers.get('x-dronesim-optimized')==='true'};
        onProgress({loaded:buffer.byteLength,total:buffer.byteLength,cached:true});return result;
      }catch{await cache.delete(spec.url);}
    }
    let response,fromLegacy=false;
    if(this.storage)for(const name of legacyCaches){try{if(!await this.storage.has(name))continue;response=await(await this.storage.open(name)).match(spec.url);if(response){fromLegacy=true;break;}}catch{}}
    if(!response)response=await this.fetcher.call(globalThis,spec.url,{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`${spec.name}: HTTP ${response.status}`);
    const chunks=[];let received=0;const total=Number(response.headers.get('content-length'))||spec.bytes||0;
    if(response.body){const reader=response.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;onProgress({loaded:received,total,cached:fromLegacy});}}finally{reader.releaseLock();}}
    else{const bytes=new Uint8Array(await response.arrayBuffer());chunks.push(bytes);received=bytes.length;}
    let buffer=await new Blob(chunks).arrayBuffer();const originalBytes=buffer.byteLength;
    if(spec.sha256&&await sha256(buffer)!==spec.sha256){if(fromLegacy)for(const name of legacyCaches){try{await(await this.storage.open(name)).delete(spec.url);}catch{}}throw new Error(`${spec.name}: model integrity check failed. Retry the download.`);}
    if(spec.kind==='panorama'){
      const header=new TextDecoder().decode(new Uint8Array(buffer,0,Math.min(4096,buffer.byteLength)));
      if(!header.startsWith('#?')||!/-Y\s+1024\s+\+X\s+2048/.test(header))throw new Error(`${spec.name}: expected a 2K HDR panorama.`);
    }
    if(spec.kind==='model')buffer=await this.optimizer(buffer);
    const optimized=buffer.byteLength<originalBytes;let blob=new Blob([buffer]),encoding='raw';
    if(typeof CompressionStream==='function'&&typeof DecompressionStream==='function'){
      const compressed=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
      if(compressed.size<blob.size){blob=compressed;encoding='gzip';}
    }
    const storedBytes=blob.size;
    let saved=false;
    if(cache)try{await cache.put(spec.url,new Response(blob,{headers:{'content-type':'application/octet-stream','x-dronesim-encoding':encoding,'x-dronesim-sha256':await sha256(buffer),'x-dronesim-source-sha256':spec.sha256||'','x-dronesim-original-bytes':String(originalBytes),'x-dronesim-stored-bytes':String(storedBytes),'x-dronesim-optimized':String(optimized)}}));saved=true;}catch{this.cacheAvailable=false;}
    const result={buffer,cached:fromLegacy,originalBytes,storedBytes,optimized};if(!saved)this.memoryFallback.set(spec.url,result);
    onProgress({loaded:originalBytes,total:originalBytes,cached:fromLegacy});return result;
  }
  async preload(specs,onProgress=()=>{},{concurrency=3}={}){
    const states=specs.map(spec=>({name:spec.name,loaded:0,total:0,done:false,cached:false}));let next=0;
    const results=new Array(specs.length),failures=[];
    const publish=()=>onProgress({completed:states.filter(s=>s.done).length,total:specs.length,fraction:states.reduce((sum,s)=>sum+(s.done?1:s.total?Math.min(0.95,s.loaded/s.total):0),0)/specs.length,bytes:states.reduce((sum,s)=>sum+s.loaded,0),current:states.filter(s=>!s.done&&s.loaded).map(s=>s.name).slice(0,3).join(', '),storedBytes:results.reduce((sum,r)=>sum+(r?.storedBytes||0),0),originalBytes:results.reduce((sum,r)=>sum+(r?.originalBytes||0),0),cached:results.filter(r=>r?.cached).length,cacheAvailable:this.cacheAvailable});
    publish();
    await Promise.all(Array.from({length:Math.min(concurrency,specs.length)},async()=>{
      while(next<specs.length){const index=next++;try{const {buffer,...metadata}=await this.get(specs[index],update=>{Object.assign(states[index],update);publish();});results[index]=metadata;states[index].done=true;}catch(error){failures.push({name:specs[index].name,message:error.message});}publish();}
    }));
    if(failures.length)throw new Error(failures.map(f=>f.message).join('\n'));
    return {originalBytes:results.reduce((sum,r)=>sum+r.originalBytes,0),storedBytes:results.reduce((sum,r)=>sum+r.storedBytes,0),cached:results.filter(r=>r.cached).length,cacheAvailable:this.cacheAvailable};
  }
}
