import * as THREE from 'three';
import { box, sphere, cone } from './models.js';
import { random } from './config.js';
export function createWorld(config,seed) {
  const world=new THREE.Group(),rng=random(seed), spread=()=> (rng()-0.5)*180;
  const ground=box(world,0,-0.6,0,400,1,400,config.ground);
  if(config.water) { const water=box(world,config.id==='island'?0:60,-0.03,config.id==='island'?0:-25,config.id==='island'?330:105,0.12,330,'#61969f'); if(config.id==='island') ground.scale.set(0.32,1,0.32); water.material=new THREE.MeshStandardMaterial({color:'#619da9',roughness:0.3,metalness:0.15}); }
  for(let i=0;i<(config.trees||0);i++) {
    let x=spread(),z=spread();if(config.water&&x>5) x-=80;
    const h=4+rng()*9, palm=config.style==='palm', broad=config.style==='broad';
    box(world,x,h/2,z,palm?0.35:0.6,h,0.45,'#6f5940');
    if(palm) {for(let j=0;j<6;j++){const leaf=box(world,x,h,z,5,0.12,0.7,'#55754d');leaf.rotation.y=j*Math.PI/3;leaf.rotation.z=0.18;} }
    else if(broad) sphere(world,x,h,z,3+rng(),2.4,3,'#48663f');
    else {cone(world,x,h-0.4,z,2.5,h*0.8,config.style==='snow'?'#c7d7cf':'#3e5b41');cone(world,x,h+1,z,1.8,h*0.6,config.style==='snow'?'#e8eeeb':'#4b6d4c');}
  }
  if(config.buildings) {
    for(let i=0;i<config.buildings;i++) {
      const col=i%10,row=Math.floor(i/10),x=(col-4.5)*16,z=(row-4)*19;
      const industrial=config.id==='industrial'||config.id==='harbor',city=config.id==='city';
      const h=city?6+rng()*32:industrial?4+rng()*7:3+rng()*4,w=6+rng()*5,d=6+rng()*5;
      box(world,x,h/2,z,w,h,d,['#b4b0a4','#a0a8ab','#d1cab9','#8b999b'][i%4]);
      if(!city&&!industrial){const roof=cone(world,x,h+1.4,z,w*0.8,2.8,'#8a6f5b',4);roof.rotation.y=Math.PI/4;}
      else {box(world,x,h+0.4,z,w*0.4,0.8,d*0.4,'#727d80');}
      for(let floor=2;floor<h-1;floor+=3) for(let wx=-w/2+1;wx<w/2;wx+=2) box(world,x+wx,floor,z-d/2-0.02,0.8,1.1,0.05,'#50656b');
    }
    for(let i=-4;i<5;i++) box(world,0,0.01,i*19+9,190,0.08,4,'#626869');
  }
  for(let i=0;i<(config.rocks||0);i++) {const size=1+rng()*5;sphere(world,spread(),size*0.35,spread(),size,size*0.7,size*0.8,config.id==='canyon'?'#a96f4e':'#85857b');}
  if(config.hills) for(let i=0;i<24;i++) {const a=i/24*Math.PI*2,r=105+rng()*45,h=15+rng()*55;cone(world,Math.cos(a)*r,h/2-1,Math.sin(a)*r,15+rng()*20,h,config.id==='snow'?'#e5e9e9':config.ground,7);}
  if(config.fields) for(let i=0;i<12;i++) {box(world,(i%4-1.5)*40,0.01,(Math.floor(i/4)-1)*55,37,0.06,50,['#8d985b','#b7aa6a','#7d8c51'][i%3]);for(let j=0;j<10;j++)box(world,(i%4-1.5)*40-16+j*3.5,0.08,(Math.floor(i/4)-1)*55,0.15,0.12,48,'#c2b67b');}
  if(config.runway) {box(world,0,0.05,0,20,0.15,210,'#555d60');for(let z=-95;z<100;z+=12)box(world,0,0.14,z,0.4,0.03,5,'#edece3');box(world,-9,0.14,0,0.2,0.03,205,'#edece3');box(world,9,0.14,0,0.2,0.03,205,'#edece3');}
  return world;
}
export function disposeGroup(group) {if(!group.userData.sharedGeometry)group.traverse(o=>{if(o.geometry)o.geometry.dispose();});group.userData.ownedMaterials?.forEach(m=>m.dispose());group.removeFromParent();}
