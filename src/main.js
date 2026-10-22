import './style.css';
import { environments,objectTypes,objectLabels } from './config.js';
import { defaultObjectSettings,shapeFields,physicalSizes } from './object-settings.js';
import { Simulator } from './simulator.js';
import { droneModels } from './model-catalog.js';
import { attributionDialog } from './attributions.js';
import { zip } from './zip.js';
const $=selector=>document.querySelector(selector);
const objectSettings=Object.fromEntries(objectTypes.map(type=>[type,defaultObjectSettings(type)]));
$('#app').innerHTML=`
<aside><h1>dronesim</h1><nav><button class="active" data-section="scene">Scene</button><button data-section="objects">Objects</button><button data-section="export">Export dataset</button></nav><button id="open-attributions">Attributions</button></aside>
<main><div class="workspace"><section class="preview">
<div id="viewport"><div class="image-controls"><button id="randomize">Randomize scene</button><button id="randomize-camera">Randomize camera</button><button id="reset">Reset camera</button><button id="snapshot">Save image</button><button id="pause">Pause</button></div><div id="render-error" hidden></div><div id="asset-status" role="status" aria-live="polite" hidden></div></div>
</section>
<section class="settings" id="scene-settings"><div class="section-heading"><h3>Scene settings</h3></div>
<label>Environment<select id="environment">${environments.map(e=>`<option value="${e.id}">${e.name}</option>`).join('')}</select></label>
<div class="field-heading">Flying objects</div><div class="object-list">${objectTypes.map((type,i)=>`<label class="check"><input type="checkbox" name="type" value="${type}" ${i===0?'checked':''}>${objectLabels[i]}</label>`).join('')}</div>
<label>Objects per image<input id="count" type="number" min="1" max="30" value="1"></label>
<label>Object altitude <output id="altitude-value">2 m</output><input id="altitude" type="range" min="1" max="65" step="0.5" value="2"></label>
<label>Object spread <output id="spread-value">0 m</output><input id="spread" type="range" min="0" max="60" value="0"></label>
<div class="section-heading subsection"><h3>Camera</h3></div>
<label>Camera height <output id="camera-height-value">1.7 m</output><input id="camera-height" type="range" min="0.1" max="70" step="0.1" value="1.7"></label>
<label>Distance <output id="camera-distance-value">1 m</output><input id="camera-distance" type="range" min="0.3" max="150" step="0.1" value="1"></label>
<label>Look angle <output id="aim-angle-value">16.7°</output><input id="aim-angle" type="range" min="-60" max="85" step="0.1" value="16.7"></label>
<label>Field of view <output id="fov-value">75°</output><input id="fov" type="range" min="15" max="110" value="75"></label>
<label>Exposure <output id="exposure-value">1.0</output><input id="exposure" type="range" min="0.2" max="3" step="0.05" value="1"></label>
<label>Scene seed<input id="seed" type="number" min="0" max="4294967295" value="1042"></label>
</section>
<section class="settings" id="objects-settings" hidden><div class="section-heading"><h3>Object settings</h3></div>
<label>Object type<select id="edit-type">${objectTypes.map((type,i)=>`<option value="${type}">${objectLabels[i]}</option>`).join('')}</select></label>
<label>Model (.glb)<input id="model" type="file" accept=".glb"></label><div id="model-name" class="field-note">Built-in geometry</div><button id="remove-model" hidden>Use built-in geometry</button>
<div id="object-editor"></div><button id="reset-object">Reset object settings</button>
</section>
<section class="settings" id="export-settings" hidden><div class="section-heading"><h3>Export dataset</h3></div>
<label>Number of images<input id="batch" type="number" min="1" max="500" value="25"></label>
<label>Resolution<select id="resolution"><option value="640,480">640 × 480</option><option value="1280,720">1280 × 720</option><option value="1920,1080" selected>1920 × 1080</option><option value="3840,2160">3840 × 2160</option><option value="1024,1024">1024 × 1024</option></select></label>
<label class="check"><input id="vary-environment" type="checkbox">Vary environments</label>
<label class="check"><input id="vary-camera" type="checkbox" checked>Vary camera angle</label>
<label class="check"><input id="below-camera" type="checkbox" checked>Keep camera below objects</label>
<label class="check"><input id="empty-frames" type="checkbox">Include 10% empty frames</label>
<div class="export-detail">PNG images, instance masks, COCO annotations, YOLO labels, and scene parameters.</div>
<button id="export" class="primary">Export dataset</button><button id="cancel" hidden>Cancel export</button><progress id="progress" value="0" max="100" hidden></progress><div id="export-status" role="status" aria-live="polite">Ready to export</div>
</section></div><div id="message" role="status" aria-live="polite"></div></main>${attributionDialog()}<div id="startup-loader" role="status" aria-live="polite"><div class="startup-card"><h2>Loading assets</h2><progress id="startup-progress" max="100" value="0"></progress><div class="startup-line"><span id="startup-status">Checking cache…</span><span id="startup-percent">0%</span></div><div id="startup-detail"></div><button id="startup-retry" hidden>Retry</button></div></div>`;
let simulator,busy=false,cancelled=false,pendingGeneration=Promise.resolve(false),uiGeneration=0;
function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error);}
function settings(){return {
  environment:$('#environment').value,backgroundMode:'hdri',hdriResolution:'2k',environmentRotation:0,
  types:[...document.querySelectorAll('[name=type]:checked')].map(el=>el.value),count:Number($('#count').value),altitude:Number($('#altitude').value),spread:Number($('#spread').value),seed:Number($('#seed').value),
  cameraHeight:Number($('#camera-height').value),cameraDistance:Number($('#camera-distance').value),aimAngle:Number($('#aim-angle').value),fov:Number($('#fov').value),exposure:Number($('#exposure').value),objects:structuredClone(objectSettings),
};}
function generate(reset=false){
  if(busy||!simulator)return pendingGeneration;
  const version=++uiGeneration;message('');
  pendingGeneration=simulator.generate(settings(),reset).then(applied=>{if(applied&&version===uiGeneration)showObjectEditor();return applied;}).catch(error=>{if(version===uiGeneration)message(error.message,true);return false;});
  return pendingGeneration;
}
async function start(){
  if(busy)return;busy=true;document.querySelector('main').inert=true;document.querySelector('aside').inert=true;$('#startup-loader').hidden=false;$('#startup-retry').hidden=true;$('#startup-detail').textContent='';
  const format=bytes=>`${(bytes/1048576).toFixed(1)} MB`;
  try{
    const totals=await simulator.assets.preload(update=>{
      const percent=update.stage==='download'?Math.floor(update.fraction*85):85+Math.floor(update.completed/update.total*10);
      $('#startup-progress').value=percent;$('#startup-percent').textContent=percent+'%';
      $('#startup-status').textContent=update.stage==='download'?`${update.completed} / ${update.total} assets`: `Preparing ${update.name}`;
      $('#startup-detail').textContent=update.stage==='download'?(update.current||'Reading cached assets…'):`Cache: ${format(update.storedBytes)} / ${format(update.originalBytes)} original`;
    });
    $('#startup-progress').value=95;$('#startup-percent').textContent='95%';$('#startup-status').textContent='Preparing scene…';
    await simulator.generate(settings(),true);showObjectEditor();
    $('#startup-loader').dataset.originalBytes=String(totals.originalBytes);$('#startup-loader').dataset.storedBytes=String(totals.storedBytes);$('#startup-loader').dataset.cachedAssets=String(totals.cached);
    pendingGeneration=Promise.resolve(true);$('#startup-progress').value=100;$('#startup-percent').textContent='100%';
    if(!totals.cacheAvailable)message('Browser storage is unavailable. Assets are cached for this session only.',true);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    $('#startup-loader').hidden=true;document.querySelector('main').inert=false;document.querySelector('aside').inert=false;
  }catch(error){$('#startup-status').textContent='Could not finish loading';$('#startup-detail').textContent=error.message;$('#startup-retry').hidden=false;}
  finally{busy=false;}
}
$('#startup-retry').onclick=start;
function download(data,name){const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function showObjectEditor(){
  const type=$('#edit-type').value,p=objectSettings[type],asset=simulator?.assets.models.get(type);
  $('#model-name').textContent=asset?asset.name:'Built-in geometry';
  $('#remove-model').hidden=!asset||asset.isDefault;$('#remove-model').textContent=droneModels[type]?'Restore original model':'Use built-in geometry';
  $('#object-editor').innerHTML=`<label>Maximum dimension (m)<input data-property="size" type="number" min="0.05" max="100" step="0.05" value="${p.size}"></label>
  <label>Body color<input data-property="color" type="color" value="${p.color}"></label>
  ${asset?`<label class="check"><input data-property="tint" type="checkbox" ${p.tint?'checked':''}>Override model materials</label>`:''}
  ${[['roughness','Roughness',0,1,0.05],['metalness','Metalness',0,1,0.05],['yaw','Heading offset',-180,180,1],['pitch','Pitch',-180,180,1],['roll','Roll',-180,180,1],['rotorRpm','Propeller speed (RPM)',0,12000,100],...(!asset?shapeFields[type]:[])].map(([key,label,min,max,step])=>`<label>${label}<output data-output="${key}">${p[key]}</output><input data-property="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}"></label>`).join('')}`;
  $('#object-editor').querySelectorAll('input').forEach(input=>input.oninput=()=>{if(busy)return;const key=input.dataset.property;objectSettings[type][key]=input.type==='checkbox'?input.checked:input.type==='color'?input.value:Number(input.value);const out=$(`[data-output="${key}"]`);if(out)out.textContent=input.value;generate();});
}
try{
  simulator=new Simulator($('#viewport'),null,(text,error=false)=>{$('#asset-status').textContent=text;$('#asset-status').hidden=!text;$('#asset-status').classList.toggle('error',error);});
  start();
}catch(error){$('#startup-loader').hidden=true;document.querySelector('main').inert=false;document.querySelector('aside').inert=false;$('#render-error').hidden=false;$('#render-error').textContent='WebGL is unavailable. Enable hardware acceleration and reload.';message(error.message,true);document.querySelectorAll('#snapshot,#export,#randomize,#reset,#pause').forEach(el=>el.disabled=true);}
showObjectEditor();
for(const input of document.querySelectorAll('#scene-settings input:not([type=file]),#scene-settings select'))input.addEventListener('input',()=>{
  if(busy)return;
  if(input.name==='type'){const count=settings().types.length;$('#count').min=Math.max(1,count);if(Number($('#count').value)<count)$('#count').value=count;}
  for(const [id,suffix] of [['altitude',' m'],['spread',' m'],['camera-height',' m'],['camera-distance',' m'],['aim-angle','°'],['fov','°'],['exposure','']])$(`#${id}-value`).textContent=$(`#${id}`).value+suffix;
  if(['camera-height','camera-distance','aim-angle','fov'].includes(input.id)){simulator?.setCamera(settings());generate();return;}
  if(input.id==='altitude'){$('#aim-angle').value=(Math.atan2(settings().altitude-settings().cameraHeight,settings().cameraDistance)*180/Math.PI).toFixed(1);$('#aim-angle-value').textContent=$('#aim-angle').value+'°';}
  generate(input.id==='altitude');
});
document.querySelectorAll('[data-section]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b===button));for(const section of ['scene','objects','export'])$(`#${section}-settings`).hidden=button.dataset.section!==section;});
$('#open-attributions').onclick=()=>$('#attributions').showModal();
$('#close-attributions').onclick=()=>$('#attributions').close();
$('#attributions').onclick=event=>{if(event.target===$('#attributions')){const rect=$('#attributions').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('#attributions').close();}};
$('#edit-type').onchange=showObjectEditor;
$('#reset-object').onclick=()=>{objectSettings[$('#edit-type').value]=defaultObjectSettings($('#edit-type').value);showObjectEditor();generate();};
$('#remove-model').onclick=async()=>{if(busy)return;simulator.assets.removeModel($('#edit-type').value);showObjectEditor();await generate();};
async function importAsset(action){if(busy||!simulator)return;busy=true;message('Loading asset…');try{await action();message('');}catch(error){message(error.message,true);}finally{busy=false;}await generate();}
$('#model').onchange=()=>{const file=$('#model').files[0],type=$('#edit-type').value;if(file)importAsset(async()=>{await simulator.assets.importModel(type,file,physicalSizes[type]);showObjectEditor();});};
$('#randomize').onclick=()=>{$('#seed').value=Math.floor(Math.random()*4294967295);generate();};
$('#reset').onclick=()=>simulator.resetCamera(settings());
$('#randomize-camera').onclick=async()=>{
  if(busy||!simulator||!await pendingGeneration)return;
  const camera=simulator.randomizeCamera();if(!camera)return;
  for(const [id,key,suffix] of [['camera-height','cameraHeight',' m'],['camera-distance','cameraDistance',' m'],['aim-angle','aimAngle','°'],['fov','fov','°']]){
    $(`#${id}`).value=camera[key];$(`#${id}-value`).textContent=camera[key]+suffix;
  }
};
$('#pause').onclick=()=>{simulator.playing=!simulator.playing;$('#pause').textContent=simulator.playing?'Pause':'Resume';};
$('#snapshot').onclick=async()=>{
  if(busy||!simulator)return;busy=true;$('#snapshot').disabled=true;
  try{if(!await pendingGeneration)throw new Error('Wait for a valid scene to finish loading.');const [w,h]=$('#resolution').value.split(',').map(Number);const {image}=await simulator.capture(w,h,false);download(image,`dronesim-${settings().environment}-${settings().seed}.png`);message('Image saved.');}
  catch(error){message(error.message,true);}finally{busy=false;$('#snapshot').disabled=false;}
};
$('#cancel').onclick=()=>{cancelled=true;$('#cancel').disabled=true;$('#export-status').textContent='Cancelling…';};
$('#export').onclick=async()=>{
  if(busy||!simulator)return;
  const original=settings(),total=Number($('#batch').value),[width,height]=$('#resolution').value.split(',').map(Number),varyEnvironment=$('#vary-environment').checked,varyCamera=$('#vary-camera').checked,below=$('#below-camera').checked,emptyFrames=$('#empty-frames').checked;
  if(!Number.isInteger(total)||total<1||total>500){message('Choose between 1 and 500 images.',true);return;}
  busy=true;cancelled=false;
  const position=simulator.camera.position.clone(),target=simulator.controls.target.clone(),playing=simulator.playing;
  simulator.playing=false;simulator.controls.enabled=false;
  const disabled=[...document.querySelectorAll('input,select,button:not([data-section]):not(#cancel)')];disabled.forEach(el=>el.disabled=true);
  $('#cancel').hidden=false;$('#cancel').disabled=false;$('#progress').hidden=false;$('#progress').value=0;
  const files=[],coco={images:[],annotations:[],categories:objectLabels.map((name,id)=>({id:id+1,name}))},scenes=[];let annotationId=1;
  try{
    await pendingGeneration;
    for(let i=0;i<total;i++){
      if(cancelled)break;
      const current={...original,seed:(original.seed+i)>>>0,environment:varyEnvironment?environments[i%environments.length].id:original.environment};
      $('#export-status').textContent=`Rendering ${i+1} / ${total}`;
      await simulator.generate(current);
      if(cancelled)break;
      if(emptyFrames&&i%10===9)simulator.objects.forEach(o=>o.visible=false);
      if(varyCamera){
        const angle=i*2.399963,dist=original.cameraDistance;
        const minObjectHeight=Math.min(...simulator.objects.map(o=>o.position.y-objectSettings[o.userData.type].size/2));
        const height=below?Math.max(0.1,Math.min(original.cameraHeight*(0.6+(i%7)*0.1),minObjectHeight-0.2)):original.altitude+Math.sin(i*1.4)*original.cameraDistance*0.5;
        simulator.camera.position.set(Math.cos(angle)*dist,height,Math.sin(angle)*dist);simulator.controls.target.set(0,original.altitude,0);simulator.camera.lookAt(simulator.controls.target);
      }else{simulator.camera.position.copy(position);simulator.controls.target.copy(target);simulator.camera.lookAt(target);}
      const {image,mask,annotations,camera,background}=await simulator.capture(width,height),base=String(i+1).padStart(6,'0');
      files.push({name:`images/${base}.png`,data:image},{name:`masks/${base}.png`,data:mask});coco.images.push({id:i+1,file_name:`images/${base}.png`,width,height});
      const yolo=[];
      for(const a of annotations){if(!a.visible)continue;const [x,y,w,h]=a.bbox,classId=objectTypes.indexOf(a.type);coco.annotations.push({id:annotationId++,image_id:i+1,category_id:classId+1,bbox:a.bbox,area:a.area,iscrowd:0,instance_id:a.instance_id});yolo.push(`${classId} ${((x+w/2)/width).toFixed(6)} ${((y+h/2)/height).toFixed(6)} ${(w/width).toFixed(6)} ${(h/height).toFixed(6)}`);}
      files.push({name:`labels/${base}.txt`,data:yolo.join('\n')});scenes.push({image_id:i+1,settings:current,empty_frame:emptyFrames&&i%10===9,camera,background,objects:annotations});
      $('#progress').value=(i+1)/total*100;await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(cancelled){$('#export-status').textContent='Export cancelled.';return;}
    $('#export-status').textContent='Packing archive…';await new Promise(resolve=>setTimeout(resolve,0));
    files.push({name:'annotations.json',data:JSON.stringify(coco)},{name:'scenes.json',data:JSON.stringify({version:2,credits:simulator.assets.credits(),mask_encoding:'instance_id = red + green * 256 + blue * 65536; 0 = background',scenes})},{name:'classes.txt',data:objectLabels.join('\n')});
    const archive=await zip(files);if(cancelled){$('#export-status').textContent='Export cancelled.';return;}
    download(archive,`dronesim-${original.seed}-${total}.zip`);$('#export-status').textContent=`Exported ${total} images · ${(archive.size/1048576).toFixed(1)} MB`;
  }catch(error){message(error.message,true);$('#export-status').textContent='Export failed.';}
  finally{
    try{await simulator.generate(original);}catch(error){message(error.message,true);}
    simulator.camera.position.copy(position);simulator.controls.target.copy(target);simulator.camera.lookAt(target);simulator.playing=playing;simulator.controls.enabled=true;busy=false;
    disabled.forEach(el=>el.disabled=false);$('#cancel').hidden=true;
  }
};
