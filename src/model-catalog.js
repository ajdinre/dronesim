const revision='3c81033830a101e730f927a279af1d81a9ea0389';
const variants=[
  ['dji-mini-3','DJI Mini 3','350fcf878fb9484580dce8c5ae2aa4c1','9ac29a546d3cb0e94d776021a83d14edadd239e3743ae18edf7f97b7724a0c55',0.292388924,203823,'dji-mini-3'],
  ['dji-air-2s','DJI Air 2S','e310c02928bd42e3ba13d1160feb091a','1de1fbb8891c4674fa314d730a2aea55e3095ff50072dfd1a6e1fb44512a5389',0.584564972,142400,'dji-air-2s'],
  ['dji-mavic-3-cine','DJI Mavic 3 Cine','60d4a042a6eb4a1e944b1af2d4e9368b','5e5b8f5cb0eff4a36c6fe27350e90248114bc21cbbb793874e2626e87f36574f',0.438411853,127011,'mavic-3-cine'],
  ['dji-mini-3-pro','DJI Mini 3 Pro','274f2ad2731e42b793b784c9f8453677','38a7554907ff31c8f294b9bb314f1abb5d686b6a8b34c9f773e8ebad7d56cf73',0.291233183,194285,'dji-mini-3-pro'],
];
export const droneModels=Object.fromEntries(variants.map(([id,name,sourceId,sha256,size,triangles,slug])=>[id,{
  id,name,sha256,size,triangles,author:'aurumjuda747',
  source:`https://sketchfab.com/3d-models/${slug}-${sourceId}`,
  distributor:'https://github.com/HKUOpenSource/OpenAirTwin',
  license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  attribution:`${name} by aurumjuda747, licensed under CC BY 4.0. Normalized visual GLB distributed by OpenAirTwin.`,
  url:`https://raw.githubusercontent.com/HKUOpenSource/OpenAirTwin/${revision}/backend/static/assets/radar/drones/${id}/visual.glb`,
  changes:'Rotated from Z-up/+X-forward to Y-up/-Z-forward, centered, and scaled to the configured physical dimensions.',
}]));

droneModels['dji-mini-3'].propellers=[
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_002_1',blades:['pCylinder8_7','pCylinder8_5']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_002_2',blades:['pCylinder8_9','pCylinder8_8']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_001_1_2',blades:['pCylinder8_2_2_2','pCylinder8_11_2']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_001_1',blades:['pCylinder8','pCylinder8_11']},
];
droneModels['dji-air-2s'].propellers=[
  {motor:'Object_37',blades:['Object_43','Object_76']},
  {motor:'Object_34',blades:['Object_58','Object_49']},
  {motor:'Object_22',blades:['Object_46','Object_79']},
  {motor:'Object_28',blades:['Object_52','Object_67']},
];
droneModels['dji-mini-3-pro'].propellers=[
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_002_1',blades:['pCylinder8_7','pCylinder8_5']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_002_2',blades:['pCylinder8_9','pCylinder8_8']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_001_1',blades:['pCylinder8','pCylinder8_11']},
  {motor:'Retopo_WM162_15034CMOTORD_STATOR_ZS__2_001_2',blades:['pCylinder8_12','pCylinder8_13']},
];
droneModels['dji-mavic-3-cine'].propellers=[1,2,3,4].map(number=>({
  motor:`桨叶${number}_${number===1?'06':'07'}_1`,
  blades:Array.from({length:10},(_,i)=>`桨叶${number}_${String(i+1).padStart(2,'0')}_1`),
}));
