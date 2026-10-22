import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { environments,random,validateSettings } from './config.js';
import { rotatePropeller } from './propellers.js';
import { droneModels } from './model-catalog.js';
import { defaultObjectSettings } from './object-settings.js';
import { Assets } from './assets.js';
import { disposeGroup } from './world.js';
const blob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Image capture failed.')),'image/png'));

export class Simulator {
  constructor(container,onStats,onAssetStatus){
    this.container=container;this.onStats=onStats;this.onAssetStatus=onAssetStatus;this.scene=new THREE.Scene();this.objects=[];this.playing=true;this.elapsed=0;this.generation=0;
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio*2,2),3));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(75,1,0.01,1000);this.camera.position.set(0,1.7,1);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,2,0);this.controls.enableDamping=true;this.controls.maxDistance=300;this.controls.minDistance=0.3;this.controls.maxPolarAngle=Math.PI*0.98;
    this.fill=new THREE.HemisphereLight('#dbe9fa','#6f695c',0.6);this.scene.add(this.fill);
    this.sun=new THREE.DirectionalLight('#fff2dd',2);this.sun.position.set(40,75,25);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,far:220});this.sun.shadow.normalBias=0.02;this.sun.shadow.bias=-0.00015;this.scene.add(this.sun);
    this.assets=new Assets(this.renderer,onAssetStatus);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.clock=new THREE.Clock();
    this.renderer.setAnimationLoop(()=>{
      const dt=Math.min(this.clock.getDelta(),0.05);if(this.exporting)return;
      if(this.playing){this.elapsed+=dt;this.objects.forEach((o,i)=>{
        o.position.y=o.userData.altitude+Math.sin(this.elapsed*0.7+i)*0.04;o.userData.mixer?.update(dt);
        for(const rotor of o.userData.rotors)rotatePropeller(rotor,dt,o.userData.rotorRpm);
      });}
      this.controls.update();this.renderer.render(this.scene,this.camera);
    });
  }
  resize(){if(this.exporting)return;const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  async generate(settings,resetCamera=false){
    validateSettings(settings);const version=++this.generation;
    const missing=settings.types.filter(type=>droneModels[type]&&!this.assets.models.has(type));if(missing.length)this.onAssetStatus?.(`Loading ${missing.map(type=>droneModels[type].name).join(', ')}…`);
    try{await this.assets.ensureDefaultModels(settings.types);}catch(error){if(version===this.generation)this.onAssetStatus?.(error.message,true);throw error;}
    if(version!==this.generation)return false;
    let environment=null;
    {
      if(!this.assets.isEnvironmentReady(settings.environment,settings.hdriResolution||'2k'))this.onAssetStatus?.('Loading panorama…');
      try{
        environment=await this.assets.environment(settings.environment,'2k');
      }
      catch(error){if(version===this.generation)this.onAssetStatus?.(error.message,true);throw error;}
    }
    if(version!==this.generation)return false;
    this.onAssetStatus?.('');return this.applyScene(settings,environment,resetCamera);
  }
  applyScene(settings,environment,resetCamera=false){
    const config=environments.find(e=>e.id===settings.environment);
    this.settings=structuredClone(settings);this.elapsed=0;
    if(this.world)disposeGroup(this.world);for(const o of this.objects)disposeGroup(o);this.objects=[];
    const rng=random(settings.seed),altitude=Number(settings.altitude),spread=Number(settings.spread);
    this.world=new THREE.Group();this.scene.add(this.world);
    const rotation=THREE.MathUtils.degToRad(settings.environmentRotation||0);this.scene.backgroundRotation.set(0,rotation,0);this.scene.environmentRotation.set(0,rotation,0);
    this.scene.backgroundIntensity=1;this.scene.backgroundBlurriness=0;this.scene.environmentIntensity=Number(settings.lightIntensity??1);
    this.renderer.toneMappingExposure=Number(settings.exposure??1);this.scene.fog=null;
    if(environment){
      this.currentEnvironment=environment;this.scene.background=environment.texture;this.scene.environment=environment.target.texture;this.fill.intensity=0;
      const direction=new THREE.Vector3(...environment.sun.direction).applyAxisAngle(new THREE.Vector3(0,1,0),rotation);
      this.sun.position.copy(direction.multiplyScalar(90));this.sun.color.setRGB(...environment.sun.color);this.sun.intensity=environment.sun.strength*this.scene.environmentIntensity;
      this.assets.trim(environment);
    }
    for(let i=0;i<settings.count;i++){
      const type=settings.types[i%settings.types.length],options=settings.objects?.[type]||defaultObjectSettings(type);
      const o=this.assets.createObject(type,options);if(!o)throw new Error('The selected drone model is not loaded.');
      o.position.set((rng()-0.5)*spread,altitude+(rng()-0.5)*Math.min(altitude*0.25,4),(rng()-0.5)*spread*0.6);
      o.rotation.set(THREE.MathUtils.degToRad(options.pitch),rng()*Math.PI*2+THREE.MathUtils.degToRad(options.yaw),THREE.MathUtils.degToRad(options.roll));
      o.userData.altitude=o.position.y;o.userData.rotorRpm=options.rotorRpm;this.scene.add(o);this.objects.push(o);
    }
    this.renderer.domElement.dataset.propellers=String(this.objects.reduce((count,object)=>count+object.userData.rotors.length,0));
    this.camera.fov=Number(settings.fov??75);this.camera.updateProjectionMatrix();
    if(resetCamera)this.resetCamera(settings);
    this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
    this.onStats?.(config.name,this.objects.length);return true;
  }
  resetCamera(settings=this.settings){
    const height=Number(settings.cameraHeight??1.7),distance=Number(settings.cameraDistance??1),angle=THREE.MathUtils.degToRad(settings.aimAngle??16.7);
    this.controls.target.set(0,height+Math.tan(angle)*distance,0);
    this.camera.position.set(0,Number(settings.cameraHeight??1.7),Number(settings.cameraDistance??1));
    this.controls.update();
  }
  setCamera(settings){
    this.camera.fov=Number(settings.fov);this.camera.updateProjectionMatrix();this.resetCamera(settings);
    if(this.settings){this.settings.cameraHeight=settings.cameraHeight;this.settings.cameraDistance=settings.cameraDistance;this.settings.fov=settings.fov;}
  }
  randomizeCamera(){
    if(!this.objects.length)return null;
    this.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3();for(const object of this.objects)bounds.expandByObject(object);
    const sphere=bounds.getBoundingSphere(new THREE.Sphere()),target=sphere.center;
    const fov=60+Math.floor(Math.random()*26),halfFov=THREE.MathUtils.degToRad(fov/2);
    const limitingFov=Math.min(halfFov,Math.atan(Math.tan(halfFov)*this.camera.aspect));
    const distance=Math.max(0.3,sphere.radius/Math.sin(limitingFov)*(1.25+Math.random()*0.9));
    const below=Math.random()<0.85,offset=distance*(0.15+Math.random()*0.45);
    const height=THREE.MathUtils.clamp(target.y+(below?-offset:offset),0.1,70);
    const horizontal=Math.min(150,Math.max(0.3,Math.sqrt(Math.max(0.09,distance*distance-(height-target.y)**2))));
    const azimuth=Math.random()*Math.PI*2;
    this.camera.fov=fov;this.camera.updateProjectionMatrix();
    this.camera.position.set(target.x+Math.cos(azimuth)*horizontal,height,target.z+Math.sin(azimuth)*horizontal);
    this.controls.target.copy(target);this.controls.update();
    const values={cameraHeight:Number(height.toFixed(1)),cameraDistance:Number(horizontal.toFixed(1)),aimAngle:Number(THREE.MathUtils.radToDeg(Math.atan2(target.y-height,horizontal)).toFixed(1)),fov};
    Object.assign(this.settings,values);return values;
  }
  async capture(width,height,withMask=true){
    const size=this.renderer.getSize(new THREE.Vector2()),ratio=this.renderer.getPixelRatio(),aspect=this.camera.aspect;
    this.exporting=true;
    try{
      this.renderer.setPixelRatio(1);const supersampling=Math.max(1,Math.min(2,4096/Math.max(width,height)));this.renderer.setSize(Math.round(width*supersampling),Math.round(height*supersampling),false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.scene.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
      const output=document.createElement('canvas');output.width=width;output.height=height;const outputContext=output.getContext('2d');outputContext.imageSmoothingEnabled=true;outputContext.imageSmoothingQuality='high';outputContext.drawImage(this.renderer.domElement,0,0,width,height);const image=await blob(output);let mask=null,annotations=[];
      if(withMask){
        const originals=[],temporary=[],background=this.scene.background,fog=this.scene.fog;
        const replace=(root,id)=>root.traverse(o=>{
          if(!o.isMesh)return;originals.push([o,o.material]);const masks=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{
            const m=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB((id&255)/255,((id>>8)&255)/255,((id>>16)&255)/255,THREE.LinearSRGBColorSpace),toneMapped:false,side:source.side,map:source.map,alphaMap:source.alphaMap,alphaTest:Math.max(source.alphaTest||0,0.01)});
            m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\n diffuseColor.a *= texture2D(map,vMapUv).a;\n#endif');};
            m.customProgramCacheKey=()=> 'instance-mask-alpha-v1';temporary.push(m);return m;
          });o.material=Array.isArray(o.material)?masks:masks[0];
        });
        replace(this.world,0);this.objects.forEach((o,i)=>replace(o,i+1));
        const target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true});const pixels=new Uint8Array(width*height*4);
        try{this.scene.background=new THREE.Color(0);this.scene.fog=null;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);}
        finally{this.renderer.setRenderTarget(null);this.scene.background=background;this.scene.fog=fog;originals.forEach(([o,m])=>o.material=m);temporary.forEach(m=>m.dispose());target.dispose();}
        const bounds=this.objects.map(()=>({minX:width,minY:height,maxX:-1,maxY:-1,area:0})),rgba=new Uint8ClampedArray(pixels.length);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const index=((height-y-1)*width+x)*4,dest=(y*width+x)*4,id=pixels[index]+(pixels[index+1]<<8)+(pixels[index+2]<<16);
          rgba.set(pixels.subarray(index,index+4),dest);rgba[dest+3]=255;
          if(id>0&&id<=bounds.length){const b=bounds[id-1];b.minX=Math.min(x,b.minX);b.maxX=Math.max(x,b.maxX);b.minY=Math.min(y,b.minY);b.maxY=Math.max(y,b.maxY);b.area++;}
        }
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(rgba,width,height),0,0);mask=await blob(canvas);
        annotations=this.objects.map((o,i)=>{const b=bounds[i];return {instance_id:i+1,type:o.userData.type,asset:o.userData.asset,credit:o.userData.credit,visible:b.area>0,bbox:b.area?[b.minX,b.minY,b.maxX-b.minX+1,b.maxY-b.minY+1]:null,area:b.area,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3),scale:o.scale.toArray()};});
      }
      return {image,mask,annotations,camera:{position:this.camera.position.toArray(),target:this.controls.target.toArray(),fov:this.camera.fov,aspect:this.camera.aspect,near:this.camera.near,far:this.camera.far},background:{mode:'hdri',panorama:this.currentEnvironment?.url,rotation:this.settings.environmentRotation,exposure:this.renderer.toneMappingExposure}};
    }finally{this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();this.exporting=false;this.resize();}
  }
}
