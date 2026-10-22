import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { droneModels } from './model-catalog.js';
import { defaultObjectSettings } from './object-settings.js';
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:0.65}));return materials.get(color);}
function mesh(parent,geometry,x,y,z,color){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(parent,x,y,z,w,h,d,color){return mesh(parent,new THREE.BoxGeometry(w,h,d),x,y,z,color);}
export function sphere(parent,x,y,z,w,h,d,color){const m=mesh(parent,new THREE.SphereGeometry(1,32,20),x,y,z,color);m.scale.set(w,h,d);return m;}
export function cone(parent,x,y,z,r,h,color,vertices=8){return mesh(parent,new THREE.ConeGeometry(r,h,vertices),x,y,z,color);}
function rounded(parent,x,y,z,w,h,d,color){return mesh(parent,new RoundedBoxGeometry(w,h,d,3,Math.min(w,h,d)*0.2),x,y,z,color);}
function tube(parent,a,b,r,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);const m=mesh(parent,new THREE.CylinderGeometry(r,r,direction.length(),12),...start.clone().add(end).multiplyScalar(0.5).toArray(),color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;}
function wing(parent,points,color){const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();const m=mesh(parent,new THREE.ExtrudeGeometry(shape,{depth:0.045,bevelEnabled:true,bevelThickness:0.015,bevelSize:0.025,bevelSegments:2,steps:1}),0,0,0,color);m.rotation.x=-Math.PI/2;return m;}
function rotor(parent,x,y,z,r){const g=new THREE.Group();g.position.set(x,y,z);for(let i=0;i<2;i++){const blade=sphere(g,0,0,0,r,0.018,0.055,'#25292c');blade.rotation.y=i*Math.PI/2;}sphere(g,0,0.025,0,0.08,0.04,0.08,'#777e80');parent.add(g);return g;}
export function flyingObject(type,options={}){
  const p={...defaultObjectSettings(type),...options},g=new THREE.Group(),rotors=[],color=p.color;
  if(droneModels[type]||type==='quadcopter'){
    const span=(droneModels[type]?0.95:1.25)*p.span;
    rounded(g,0,0,0,0.68,0.24,0.95*p.body,color);rounded(g,0,0.13,0.04,0.5,0.06,0.72*p.body,color);
    for(let i=0;i<7;i++)box(g,-0.16+i*0.055,0.168,0.16,0.025,0.008,0.24,'#454b4d');
    rounded(g,0,-0.23,-0.36,0.26,0.23,0.24,'#444a4e');
    const lens=mesh(g,new THREE.CylinderGeometry(0.085,0.085,0.1,24),0,-0.23,-0.52,'#152c39');lens.rotation.x=Math.PI/2;
    const rim=mesh(g,new THREE.TorusGeometry(0.09,0.012,8,24),0,-0.23,-0.58,'#92999b');
    for(const x of [-span,span])for(const z of [-span,span]){
      tube(g,[x*0.18,-0.01,z*0.3],[x,0.02,z],type==='quadcopter'?0.045:0.065,color);
      mesh(g,new THREE.CylinderGeometry(0.12,0.11,0.17,20),x,0.13,z,'#41494e');
      for(let j=0;j<4;j++)sphere(g,x+Math.cos(j*Math.PI/2)*0.07,0.225,z+Math.sin(j*Math.PI/2)*0.07,0.012,0.007,0.012,'#a9afb0');
      rotors.push(rotor(g,x,0.25,z,0.48*p.rotor));
      tube(g,[x*0.8,0,z*0.8],[x*0.8,-0.35,z*0.8],0.025,'#444b50');
      rounded(g,x*0.8,-0.36,z*0.8,0.09,0.035,0.16,'#292f33');sphere(g,x,0.02,z,0.035,0.03,0.025,z<0?'#972f27':'#3a7952');
    }
  }else if(type==='helicopter'){
    sphere(g,0,0,0,0.61,0.59,1.25*p.body,color);sphere(g,0,0.12,-0.64*p.body,0.56,0.43,0.63,'#263c49');
    tube(g,[0,0.5,-1.02*p.body],[0,0.47,-0.32*p.body],0.025,color);
    for(const x of [-0.57,0.57]){
      rounded(g,x,0.03,0.26,0.05,0.68,0.82,'#303d43');rounded(g,x*1.02,0.12,0.24,0.025,0.45,0.58,'#314c59');
      box(g,x,-0.15,-0.03,0.04,0.03,0.12,'#bfc2c0');
      tube(g,[x,-0.7,-0.8],[x,-0.7,1],0.035,'#343b40');for(const z of [-0.5,0.6])tube(g,[x,-0.7,z],[x*0.65,-0.3,z],0.03,'#343b40');
    }
    const tail=cone(g,0,0.1,2*p.tail,0.28,2.8*p.tail,color,24);tail.rotation.x=Math.PI/2;
    wing(g,[[-0.8,-2.7*p.tail],[0,-2.5*p.tail],[0.8,-2.7*p.tail],[0,-2.95*p.tail]],color);
    rounded(g,0,0.6,3.1*p.tail,0.08,1.1,0.52,color);
    const tailRotor=rotor(g,0.14,0.35,3.15*p.tail,0.48);tailRotor.rotation.z=Math.PI/2;
    tube(g,[0,0.48,0],[0,0.94,0],0.065,'#61686b');rotors.push(rotor(g,0,0.98,0,2.7*p.rotor));
    sphere(g,0,0.45,0.5,0.35,0.3,0.7,color);
  }else if(type==='airplane'||type==='fighter jet'){
    const jet=type==='fighter jet',length=2.4*p.body,span=3*p.wings;
    sphere(g,0,0,0,jet?0.31:0.35,jet?0.32:0.4,length,color);
    sphere(g,0,0.3,-0.55*p.body,0.27,0.23,0.65*p.body,'#263e4c');
    if(jet){
      wing(g,[[-span,-1.35*p.sweep],[0,1.3],[span,-1.35*p.sweep],[0,-0.6]],color);
      for(const x of [-0.3,0.3]){
        const fin=wing(g,[[0,0],[0.75,-0.9],[0.9,-1.8],[0,-1.6]],color);fin.rotation.set(0,0,x<0?-0.25:0.25);fin.position.set(x,0.1,length*0.6);
        sphere(g,x,-0.13,length*0.67,0.23,0.23,0.72,'#30373b');
        const nozzle=mesh(g,new THREE.CylinderGeometry(0.2,0.18,0.3,24,1,true),x,-0.13,length*0.95,'#30373b');nozzle.rotation.x=Math.PI/2;
      }
      wing(g,[[-1.4,-length*0.6],[0,-length*0.4],[1.4,-length*0.6],[0,-length*0.9]],color);
    }else{
      wing(g,[[-span,0.25],[-span,-0.32],[span,-0.32],[span,0.25]],color);
      for(const x of [-span*0.8,span*0.8])box(g,x,0.035,0.02,0.025,0.012,0.5,'#747d80');
      const fin=wing(g,[[0,0],[0.9,-0.4],[0.6,-1.1],[0,-1.1]],color);fin.rotation.x=0;fin.position.z=length*0.45;
      box(g,0,0,length*0.68,1.8*p.tail,0.05,0.55,color);
      const prop=new THREE.Group();prop.position.z=-length;const blade=sphere(prop,0,0,0,0.045,0.8,0.03,'#292f33');g.add(prop);g.userData.propeller=prop;
      sphere(g,0,0,-length-0.08,0.12,0.12,0.18,color);
    }
  }else{
    sphere(g,0,0,0,0.17,0.21,0.53*p.body,color);sphere(g,0,0.13,-0.48*p.body,0.14,0.15,0.2,color);
    const beak=cone(g,0,0.1,-0.71*p.body,0.055,0.23,'#b79a62',16);beak.rotation.x=-Math.PI/2;
    for(const side of [-1,1]){
      sphere(g,side*0.12,0.16,-0.55*p.body,0.018,0.02,0.018,'#161a1c');
      const w=new THREE.Group();w.userData.side=side;g.add(w);w.rotation.z=p.bend*side;
      wing(w,[[0,0],[side*0.45,0.18],[side*1.5*p.wings,0.3],[side*1.2*p.wings,-0.15],[side*0.4,-0.35]],color);
      for(let j=0;j<7;j++){const feather=sphere(w,side*(0.65+j*0.115)*p.wings,0.015,0.09+j*0.05,0.09,0.022,0.3,color);feather.rotation.y=-side*(0.1+j*0.07);}
      rotors.push(w);
    }
    wing(g,[[0,-0.3],[-0.3,-0.85],[0.3,-0.85]],color);
  }
  const ownedMaterials=new Map();g.traverse(o=>{if(o.isMesh){if(!ownedMaterials.has(o.material)){const m=o.material.clone();m.roughness=p.roughness;m.metalness=p.metalness;ownedMaterials.set(o.material,m);}o.material=ownedMaterials.get(o.material);}});
  g.updateMatrixWorld(true);const extent=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());g.scale.setScalar(p.size/Math.max(extent.x,extent.y,extent.z));
  g.userData={...g.userData,type,rotors,wingBend:p.bend,asset:'procedural',ownedMaterials:[...ownedMaterials.values()]};return g;
}
