import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeModel } from '../src/optimize-model.js';
function makeGLB(dataTexture=false){
  const json={asset:{version:'2.0'},buffers:[{byteLength:412}],bufferViews:[{buffer:0,byteOffset:0,byteLength:12},{buffer:0,byteOffset:12,byteLength:400}],accessors:[{bufferView:0,componentType:5126,count:1,type:'VEC3'}],images:[{bufferView:1,mimeType:'image/png'}],textures:[{source:0}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}},...(dataTexture?{normalTexture:{index:0}}:{})}],nodes:[{name:'original_propeller',mesh:0}]};
  const encoded=new TextEncoder().encode(JSON.stringify(json)),length=(encoded.length+3)&~3,buffer=new ArrayBuffer(12+8+length+8+412),view=new DataView(buffer),bytes=new Uint8Array(buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+length);bytes.set(encoded,20);view.setUint32(20+length,412,true);view.setUint32(24+length,0x004e4942,true);bytes.set(new Uint8Array(new Float32Array([1,2,3]).buffer),28+length);bytes.fill(123,40+length);return buffer;
}
test('reduce color textures without changing geometry, node names, or buffer alignment',async()=>{
  const output=await optimizeModel(makeGLB(),{imageOptimizer:async()=>({bytes:new Uint8Array([1,2,3,4]),mimeType:'image/webp'})});
  const view=new DataView(output),length=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(output,20,length)));
  assert.equal(json.nodes[0].name,'original_propeller');assert.equal(json.images[0].mimeType,'image/webp');assert.equal(json.textures[0].extensions.EXT_texture_webp.source,0);assert.ok(json.extensionsRequired.includes('EXT_texture_webp'));assert.equal(json.bufferViews[1].byteOffset%4,0);assert.deepEqual([...new Float32Array(output,28+length,3)],[1,2,3]);assert.ok(output.byteLength<makeGLB().byteLength);
});
test('preserve normal maps and other material data textures',async()=>{const input=makeGLB(true);let called=false;const output=await optimizeModel(input,{imageOptimizer:async()=>{called=true;return null;}});assert.equal(called,false);assert.equal(output,input);});
