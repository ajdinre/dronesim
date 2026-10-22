import test from 'node:test';
import assert from 'node:assert/strict';
import { environments,objectTypes,random,validateSettings } from '../src/config.js';
import { flyingObject } from '../src/models.js';
import { createWorld,disposeGroup } from '../src/world.js';
import { crc32,zip } from '../src/zip.js';
test('all 20 environments produce finite geometry',()=>{
  assert.equal(environments.length,20);assert.equal(new Set(environments.map(e=>e.id)).size,20);
  for(const e of environments){const group=createWorld(e,123);assert.ok(group.children.length);group.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();assert.ok(Number.isFinite(mesh.geometry.boundingBox.max.x),e.id);assert.ok(mesh.position.toArray().every(Number.isFinite),e.id);}});disposeGroup(group);}
});
test('all flying objects have finite bounds',()=>{assert.equal(objectTypes.length,4);for(const type of objectTypes){const object=flyingObject(type);let meshes=0;object.traverse(mesh=>{if(mesh.isMesh){meshes++;assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite),type);}});assert.ok(meshes>2,type);disposeGroup(object);}});
test('seeded scenes are reproducible and distinct',()=>{const a=random(12),b=random(12),c=random(13);const first=Array.from({length:20},()=>a());assert.deepEqual(first,Array.from({length:20},()=>b()));assert.notDeepEqual(first,Array.from({length:20},()=>c()));});
test('reject invalid selection and counts',()=>{const s={environment:'forest',types:['dji-mini-3'],count:1};assert.doesNotThrow(()=>validateSettings(s));for(const patch of [{types:[]},{count:0},{count:31},{count:1.5},{environment:'invalid'}])assert.throws(()=>validateSettings({...s,...patch}));});
test('zip stores binary and text with valid checksums and directory offsets',async()=>{assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);const archive=await zip([{name:'images/test.png',data:new Uint8Array([137,80,78,71])},{name:'labels/test.txt',data:'0 0.5 0.5 0.1 0.1'}]);const bytes=new Uint8Array(await archive.arrayBuffer()),v=new DataView(bytes.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);assert.equal(v.getUint16(bytes.length-12,true),2);const central=v.getUint32(bytes.length-6,true);assert.equal(v.getUint32(central,true),0x02014b50);assert.equal(v.getUint32(14,true),crc32(new Uint8Array([137,80,78,71])));});
