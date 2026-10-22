import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preparePropellers,rotatePropeller } from '../src/propellers.js';
function fixture(merged){
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),body=new THREE.BoxGeometry(0.09,0.04,0.14),geometries=[body];
  for(const x of [-0.09,0.09])for(const z of [-0.09,0.09])geometries.push(new THREE.BoxGeometry(0.13,0.002,0.012).translate(x,0.04,z));
  if(merged)root.add(new THREE.Mesh(mergeGeometries(geometries),material));else geometries.forEach(g=>root.add(new THREE.Mesh(g,material)));
  return root;
}
for(const merged of [false,true])test(`rotate four propellers without moving the body (${merged?'merged':'separate'} geometry)`,()=>{
  const root=fixture(merged);assert.equal(preparePropellers(root),4);const body=root.children.find(o=>o.isMesh),bodyTransform=body.matrixWorld.clone();
  const rotors=root.children.filter(o=>o.userData.isPropeller);assert.equal(rotors.length,4);
  const angles=rotors.map(o=>o.quaternion.clone());rotors.forEach(o=>rotatePropeller(o,0.01,4800));root.updateMatrixWorld(true);
  assert.deepEqual(body.matrixWorld.elements,bodyTransform.elements);rotors.forEach((o,i)=>assert.ok(o.quaternion.angleTo(angles[i])>0.1));
  assert.deepEqual(root.rotation.toArray(),[0,0,0,'XYZ']);
});
test('zero RPM leaves propellers still',()=>{const rotor=new THREE.Group(),original=rotor.quaternion.clone();rotatePropeller(rotor,1,0);assert.ok(rotor.quaternion.equals(original));});
