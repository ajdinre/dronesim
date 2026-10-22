import * as THREE from 'three';

function bladeBounds(bounds,whole){
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),body=whole.getSize(new THREE.Vector3()),origin=whole.getCenter(new THREE.Vector3());
  const span=Math.max(size.x,size.z),width=Math.max(body.x,body.z);
  return span>width*0.1&&span<width*0.8&&size.y<span*0.16&&Math.hypot(center.x-origin.x,center.z-origin.z)>width*0.15&&center.y>whole.min.y+body.y*0.58;
}

function subset(source,indices,materialIndices){
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  geometry.setIndex(indices);let groupStart=0;
  for(let i=1;i<=materialIndices.length;i++)if(i===materialIndices.length||materialIndices[i]!==materialIndices[groupStart]){geometry.addGroup(groupStart*3,(i-groupStart)*3,materialIndices[groupStart]);groupStart=i;}
  return geometry;
}

function splitBlades(mesh,transform,whole){
  const geometry=mesh.geometry,positions=geometry.getAttribute('position'),index=geometry.index;
  if(!positions||mesh.isSkinnedMesh||geometry.morphAttributes.position?.length)return [];
  const parent=new Int32Array(positions.count),welded=new Map(),point=new THREE.Vector3();
  const scale=whole.getSize(new THREE.Vector3()).length()*1e-6||1e-6;
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(transform);
    const key=`${Math.round(point.x/scale)},${Math.round(point.y/scale)},${Math.round(point.z/scale)}`;
    const other=welded.get(key);parent[i]=other??i;if(other===undefined)welded.set(key,i);
  }
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const count=index?.count??positions.count,vertex=i=>index?index.getX(i):i;
  for(let i=0;i<count;i+=3){const a=find(vertex(i));parent[find(vertex(i+1))]=a;parent[find(vertex(i+2))]=a;}
  const components=new Map();let materialGroup=0;
  for(let i=0;i<count;i+=3){
    while(materialGroup<geometry.groups.length-1&&i>=geometry.groups[materialGroup].start+geometry.groups[materialGroup].count)materialGroup++;
    const material=geometry.groups[materialGroup]?.materialIndex??0,key=find(vertex(i));
    if(!components.has(key))components.set(key,{indices:[],materials:[],bounds:new THREE.Box3()});
    const component=components.get(key);component.materials.push(material);
    for(let j=0;j<3;j++){const v=vertex(i+j);component.indices.push(v);component.bounds.expandByPoint(point.fromBufferAttribute(positions,v).applyMatrix4(transform));}
  }
  const blades=[...components.values()].filter(component=>component.indices.length>=6&&bladeBounds(component.bounds,whole));
  if(!blades.length)return [];
  const selected=new Set(blades),bodyIndices=[],bodyMaterials=[];
  for(const component of components.values())if(!selected.has(component)){for(const value of component.indices)bodyIndices.push(value);for(const value of component.materials)bodyMaterials.push(value);}
  if(!bodyIndices.length)return [];
  mesh.geometry=subset(geometry,bodyIndices,bodyMaterials);
  const result=[];
  for(const component of blades){const blade=new THREE.Mesh(subset(geometry,component.indices,component.materials),mesh.material);blade.name=mesh.name+'_propeller';blade.position.copy(mesh.position);blade.quaternion.copy(mesh.quaternion);blade.scale.copy(mesh.scale);blade.castShadow=true;blade.receiveShadow=true;mesh.parent.add(blade);result.push({mesh:blade,bounds:component.bounds});}
  return result;
}

export function preparePropellers(root,bindings){
  if(bindings?.length){
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
    const parts=bindings.map(binding=>({motor:root.getObjectByName(binding.motor),blades:binding.blades.map(name=>root.getObjectByName(name))}));
    if(parts.some(part=>!part.motor||part.blades.some(blade=>!blade)))throw new Error('Drone propeller parts do not match the verified model.');
    for(let i=0;i<parts.length;i++){
      const {motor,blades}=parts[i],pivot=new THREE.Group(),position=new THREE.Box3().setFromObject(motor).getCenter(new THREE.Vector3()).applyMatrix4(inverse);
      pivot.position.copy(position);pivot.name=`propeller_${i}`;pivot.userData.isPropeller=true;pivot.userData.direction=Math.sign(position.x*position.z)||1;
      root.add(pivot);root.updateMatrixWorld(true);blades.forEach(blade=>pivot.attach(blade));
    }
    root.updateMatrixWorld(true);return parts.length;
  }
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),whole=new THREE.Box3().setFromObject(root).applyMatrix4(inverse),candidates=[],meshes=[];
  root.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o);});
  for(const mesh of meshes){
    const transform=inverse.clone().multiply(mesh.matrixWorld),bounds=new THREE.Box3();
    const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,p=new THREE.Vector3();
    for(let i=0;i<(index?.count??positions.count);i++)bounds.expandByPoint(p.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(transform));
    if(bladeBounds(bounds,whole))candidates.push({mesh,bounds});
    else if(bounds.getSize(p).length()>whole.getSize(new THREE.Vector3()).length()*0.4)candidates.push(...splitBlades(mesh,transform,whole));
  }
  root.updateMatrixWorld(true);
  const center=whole.getCenter(new THREE.Vector3()),clusters=new Map();
  for(const candidate of candidates){const c=candidate.bounds.getCenter(new THREE.Vector3()),key=`${c.x>center.x?1:-1},${c.z>center.z?1:-1}`;if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(candidate);}
  let count=0;
  for(const parts of clusters.values()){
    const pivot=new THREE.Group(),position=new THREE.Vector3();for(const part of parts)position.add(part.bounds.getCenter(new THREE.Vector3()));position.divideScalar(parts.length);
    pivot.position.copy(position);pivot.name=`propeller_${count++}`;pivot.userData.isPropeller=true;pivot.userData.direction=Math.sign((position.x-center.x)*(position.z-center.z))||1;
    root.add(pivot);root.updateMatrixWorld(true);for(const part of parts)pivot.attach(part.mesh);
  }
  root.updateMatrixWorld(true);return count;
}

export function rotatePropeller(rotor,dt,rpm){rotor.rotateY(dt*rpm*Math.PI/30*(rotor.userData.direction||1));}
