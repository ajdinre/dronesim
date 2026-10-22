import { droneModels } from './model-catalog.js';
export const physicalSizes={...Object.fromEntries(Object.values(droneModels).map(model=>[model.id,model.size])),quadcopter:0.45,helicopter:12,airplane:11,'fighter jet':15,bird:1.1};
export const shapeFields={
  ...Object.fromEntries(Object.keys(droneModels).map(id=>[id,[]])),
  quadcopter:[['span','Arm span',0.6,2.5,0.1],['rotor','Propeller size',0.4,1.6,0.1],['body','Body length',0.6,1.6,0.1]],
  helicopter:[['rotor','Rotor diameter',0.6,1.6,0.1],['tail','Tail length',0.6,1.5,0.1],['body','Fuselage length',0.6,1.5,0.1]],
  airplane:[['wings','Wingspan',0.6,1.8,0.1],['body','Fuselage length',0.6,1.6,0.1],['tail','Tail span',0.6,1.8,0.1]],
  'fighter jet':[['wings','Wingspan',0.6,1.8,0.1],['body','Fuselage length',0.6,1.6,0.1],['sweep','Wing sweep',0.3,1.5,0.1]],
  bird:[['wings','Wingspan',0.6,1.8,0.1],['body','Body length',0.6,1.6,0.1],['bend','Wing bend',-0.6,0.6,0.1]],
};
export function defaultObjectSettings(type){return {size:physicalSizes[type],color:type==='bird'?'#55534b':type==='fighter jet'?'#778181':type==='quadcopter'?'#303437':'#d9dddd',roughness:type==='bird'?0.85:0.38,metalness:type==='fighter jet'?0.6:0.12,yaw:0,pitch:0,roll:0,rotorRpm:type==='helicopter'?450:type==='airplane'?2200:type==='bird'?0:4800,span:1,rotor:1,body:1,tail:1,wings:1,sweep:1,bend:0,tint:false};}
export function validateObjectSettings(type,options){
  if(!physicalSizes[type])throw new Error('Unknown flying object.');
  for(const [key,min,max] of [['size',0.05,100],['roughness',0,1],['metalness',0,1],['yaw',-180,180],['pitch',-180,180],['roll',-180,180],['rotorRpm',0,12000],...(shapeFields[type]||[]).map(([key,,min,max])=>[key,min,max])]){
    if(!Number.isFinite(options[key])||options[key]<min||options[key]>max)throw new Error(`Invalid ${key} for ${type}.`);
  }
  if(!/^#[0-9a-f]{6}$/i.test(options.color))throw new Error('Choose a valid body color.');
}
