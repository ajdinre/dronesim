import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { findSun,normalizeModel,panoramas } from '../src/assets.js';
import { environments,objectTypes } from '../src/config.js';
import { defaultObjectSettings,shapeFields,validateObjectSettings } from '../src/object-settings.js';
import { flyingObject } from '../src/models.js';
import { disposeGroup } from '../src/world.js';

test('all environments have unique photographic assets',()=>{assert.equal(new Set(Object.values(panoramas)).size,20);for(const e of environments)assert.ok(panoramas[e.id],e.id);});
test('every object supports physical sizing and valid custom shapes',()=>{
  for(const type of objectTypes){const defaults=defaultObjectSettings(type);validateObjectSettings(type,defaults);assert.ok(Array.isArray(shapeFields[type]));
    for(const patch of [{size:2},{...Object.fromEntries(shapeFields[type].map(([key,,min,max])=>[key,(min+max)/2])),size:3}]){
      const object=flyingObject(type,{...defaults,...patch});object.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-patch.size)<0.0001,type);disposeGroup(object);
    }
    assert.throws(()=>validateObjectSettings(type,{...defaults,size:0}));
  }
});
test('imported models are centered and scaled in world coordinates',()=>{
  const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(4,2,6));mesh.position.set(9,-4,2);root.add(mesh);const normalized=normalizeModel(root,12),box=new THREE.Box3().setFromObject(normalized),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());assert.equal(Math.max(size.x,size.y,size.z),12);assert.ok(center.length()<1e-8);mesh.geometry.dispose();mesh.material.dispose();
});
test('HDR lighting extracts the upper hemisphere light direction',()=>{
  const width=16,height=8,data=new Float32Array(width*height*4).fill(0.1),index=(2*width+4)*4;data[index]=100;data[index+1]=100;data[index+2]=100;const sun=findSun({data,width,height,type:THREE.FloatType});assert.ok(sun.direction[1]>0);assert.ok(sun.direction[2]<0);assert.ok(sun.strength>0);assert.ok(Math.abs(new THREE.Vector3(...sun.direction).length()-1)<1e-8);
});
