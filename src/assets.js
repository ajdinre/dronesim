import * as THREE from 'three';
import { AssetCache } from './asset-cache.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { physicalSizes } from './object-settings.js';
import { preparePropellers } from './propellers.js';
import { droneModels } from './model-catalog.js';

export const panoramas = {
  forest:'autumn_forest_04', beach:'secluded_beach', city:'potsdamer_platz', desert:'goegap',
  mountains:'alps_field', snow:'snow_field_2', farmland:'farm_road', suburbs:'suburban_field_01',
  industrial:'industrial_sunset', harbor:'small_harbor_01', lake:'shudu_lake', grassland:'meadow_2',
  jungle:'nature_reserve_forest', canyon:'quarry_01', island:'umhlanga_sunrise', airport:'derelict_airfield_01',
  wetlands:'river_rocks', tundra:'kloppenheim_06', savanna:'kiara_1_dawn', volcanic:'veld_fire',
};

export function normalizeModel(root,size) {
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),extent=bounds.getSize(new THREE.Vector3()),maximum=Math.max(extent.x,extent.y,extent.z);
  if(!Number.isFinite(maximum)||maximum<=0)throw new Error('Model has no visible geometry.');
  if(!Number.isFinite(size)||size<=0)throw new Error('Model size must be positive.');
  const wrapper=new THREE.Group(),scale=size/maximum;
  const center=bounds.getCenter(new THREE.Vector3());
  root.position.sub(center);wrapper.add(root);wrapper.scale.setScalar(scale);
  wrapper.updateMatrixWorld(true);return wrapper;
}

export function disposeAsset(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}

export class Assets {
  constructor(renderer,onStatus) {
    this.renderer=renderer;this.onStatus=onStatus;this.environments=new Map();this.models=new Map();this.defaultModelPromises=new Map();this.cache=new AssetCache();
    this.pmrem=new THREE.PMREMGenerator(renderer);this.pmrem.compileEquirectangularShader();
    this.draco=new DRACOLoader().setDecoderPath('/decoders/draco/');
    this.ktx=new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
    this.gltf=new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx).setMeshoptDecoder(MeshoptDecoder);
  }
  panoramaId(id){return panoramas[id];}
  isEnvironmentReady(id){return Boolean(this.environments.get(`${panoramas[id]}-2k`)?.texture);}
  panoramaSpec(id){return {name:id,kind:'panorama',url:`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${panoramas[id]}_2k.hdr`};}
  modelSpec(type){const model=droneModels[type];return {...model,kind:'model'};}
  async preload(onProgress){
    const specs=[...Object.keys(droneModels).map(type=>this.modelSpec(type)),...Object.keys(panoramas).map(id=>this.panoramaSpec(id))];
    const totals=await this.cache.preload(specs,p=>onProgress({...p,stage:'download'}));
    let prepared=0;
    for(const type of Object.keys(droneModels)){onProgress({stage:'prepare',completed:prepared,total:4,name:droneModels[type].name,...totals});await this.loadDefaultModel(type);prepared++;await new Promise(resolve=>setTimeout(resolve,0));}
    return totals;
  }
  async environment(id,resolution='2k') {
    if(resolution!=='2k')throw new Error('Only 2K panoramas are supported.');
    if(parseInt(resolution)*1024>this.renderer.capabilities.maxTextureSize)throw new Error('Panorama exceeds GPU texture size. Choose a lower resolution.');
    const slug=panoramas[id];if(!slug)throw new Error('No photographic panorama for this environment.');
    const key=`${slug}-${resolution}`;
    if(!this.environments.has(key)) {
      const url=`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${resolution}/${slug}_${resolution}.hdr`;
      const entry={key,url,promise:null,texture:null,target:null,used:Date.now()};
      entry.promise=(async()=>{
        let buffer;
        try {
          ({buffer}=await this.cache.get(this.panoramaSpec(id)));
          const parsed=new HDRLoader().parse(buffer),texture=new THREE.DataTexture(parsed.data,parsed.width,parsed.height,THREE.RGBAFormat,parsed.type);
          texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.flipY=true;texture.needsUpdate=true;
          if(parsed.width>this.renderer.capabilities.maxTextureSize){texture.dispose();throw new Error('Panorama exceeds GPU texture size. Choose a lower resolution.');}
          entry.texture=texture;entry.target=this.pmrem.fromEquirectangular(texture);entry.sun=findSun(parsed);return entry;
        }catch(error){entry.texture?.dispose();entry.target?.dispose();this.environments.delete(key);throw new Error(`Could not load ${slug}. Check your connection and retry. ${error.message}`);}
      })();
      this.environments.set(key,entry);
    }
    const entry=this.environments.get(key);entry.used=Date.now();return entry.promise;
  }
  trim(keep) {
    const loaded=[...this.environments.values()].filter(e=>e.texture&&e!==keep).sort((a,b)=>b.used-a.used);
    for(const entry of loaded.slice(1)){entry.target.dispose();entry.texture.dispose();this.environments.delete(entry.key);}
  }
  async ensureDefaultModels(types) {
    await Promise.all(types.filter(type=>droneModels[type]&&!this.models.has(type)).map(type=>this.loadDefaultModel(type)));
  }
  async loadDefaultModel(type){
    const model=droneModels[type];if(!model)throw new Error('Unknown drone variant.');
    if(!this.defaultModelPromises.has(type))this.defaultModelPromises.set(type,(async()=>{
      const {buffer}=await this.cache.get(this.modelSpec(type));
      const asset=await this.parseModel({name:model.name+'.glb',arrayBuffer:async()=>buffer});
      const upright=new THREE.Group();upright.rotation.x=-Math.PI/2;upright.add(asset.root);
      const aligned=new THREE.Group();aligned.rotation.y=Math.PI/2;aligned.add(upright);
      asset.root=normalizeModel(aligned,model.size);asset.propellerCount=preparePropellers(asset.root,model.propellers);asset.name=model.name;asset.credit=model;asset.isDefault=true;
      if(this.models.has(type)){disposeAsset(asset.root);return;}
      this.models.set(type,asset);
    })().catch(error=>{this.defaultModelPromises.delete(type);throw new Error(`Could not load ${model.name}. ${error.message}`);}));
    return this.defaultModelPromises.get(type);
  }
  credits(){return [...this.models.values()].filter(a=>a.credit).map(a=>a.credit);}
  async parseModel(file) {
    if(!file.name.toLowerCase().endsWith('.glb'))throw new Error('Choose a self-contained GLB model with embedded textures.');
    const buffer=await file.arrayBuffer();if(buffer.byteLength<20||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('Invalid GLB file.');
    const result=await this.gltf.parseAsync(buffer,'');let triangles=0;
    result.scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;o.castShadow=true;o.receiveShadow=true;}});
    if(triangles===0){disposeAsset(result.scene);throw new Error('The model has no mesh geometry.');}
    return {root:result.scene,clips:result.animations,name:file.name,triangles};
  }
  async importModel(type,file,size) {
    const asset=await this.parseModel(file);
    try{asset.root=normalizeModel(asset.root,size);}catch(error){disposeAsset(asset.root);throw error;}
    const old=this.models.get(type);this.models.set(type,asset);if(old)disposeAsset(old.root);return asset;
  }
  createObject(type,options) {
    const asset=this.models.get(type);if(!asset)return null;
    const root=new THREE.Group(),instance=clone(asset.root);root.add(instance);root.scale.setScalar(options.size/physicalSizes[type]);
    const rotors=[];instance.traverse(o=>{if(o.userData.isPropeller)rotors.push(o);});
    root.userData={type,rotors,asset:asset.name,credit:asset.credit,sharedGeometry:true,ownedMaterials:[]};
    if(options.tint)instance.traverse(o=>{if(o.isMesh){o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const copy=m.clone();copy.color?.set(options.color);copy.roughness=options.roughness;copy.metalness=options.metalness;root.userData.ownedMaterials.push(copy);return copy;});if(o.material.length===1)o.material=o.material[0];}});
    if(asset.clips.length){const mixer=new THREE.AnimationMixer(instance);mixer.clipAction(asset.clips[0]).play();mixer.update(0);root.userData.mixer=mixer;}
    return root;
  }
  removeModel(type){this.defaultModelPromises.delete(type);const asset=this.models.get(type);if(asset){disposeAsset(asset.root);this.models.delete(type);}}

}

export function findSun(parsed) {
  const {data,width,height,type}=parsed;let strongest=0,best=null,sum=0,count=0;
  const linear=value=>type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(value):value;
  const step=Math.max(1,Math.floor(width/1024));
  for(let y=0;y<height/2;y+=step)for(let x=0;x<width;x+=step){const i=(y*width+x)*4,r=linear(data[i]),g=linear(data[i+1]),b=linear(data[i+2]),luminance=0.2126*r+0.7152*g+0.0722*b;sum+=luminance;count++;if(luminance>strongest){strongest=luminance;best={x,y,r,g,b};}}
  if(!best)return {direction:[0,1,0],color:[1,1,1],strength:0};
  const phi=best.x/width*Math.PI*2,theta=best.y/height*Math.PI;
  return {direction:[-Math.sin(theta)*Math.cos(phi),Math.cos(theta),-Math.sin(theta)*Math.sin(phi)],color:[best.r/strongest,best.g/strongest,best.b/strongest],strength:Math.min(3,Math.max(0,(strongest/Math.max(sum/count,0.001)-8)/80))};
}
