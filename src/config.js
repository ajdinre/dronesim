import { droneModels } from './model-catalog.js';
import { validateObjectSettings } from './object-settings.js';
export const environments = [
  { id:'forest', name:'Forest', ground:'#526747', sky:'#c1d8df', trees:110, style:'pine' },
  { id:'beach', name:'Beach', ground:'#d9c493', sky:'#b9d9eb', trees:16, water:true, style:'palm' },
  { id:'city', name:'City', ground:'#8c9294', sky:'#c8d3dc', buildings:90 },
  { id:'desert', name:'Desert', ground:'#cfab78', sky:'#e8d8bf', rocks:45, hills:true },
  { id:'mountains', name:'Mountains', ground:'#82917e', sky:'#bacbd9', rocks:90, hills:true },
  { id:'snow', name:'Snowfield', ground:'#edf1f3', sky:'#cbd9e8', trees:35, style:'snow', hills:true },
  { id:'farmland', name:'Farmland', ground:'#aaa86b', sky:'#d4e0df', fields:true, buildings:7 },
  { id:'suburbs', name:'Suburbs', ground:'#77926a', sky:'#cddce2', buildings:35, trees:30 },
  { id:'industrial', name:'Industrial', ground:'#92908a', sky:'#bfc6cc', buildings:45 },
  { id:'harbor', name:'Harbor', ground:'#979c98', sky:'#cbd8dd', water:true, buildings:22 },
  { id:'lake', name:'Lake', ground:'#6e8561', sky:'#bed5df', water:true, trees:70 },
  { id:'grassland', name:'Grassland', ground:'#93a36a', sky:'#ccdee5', trees:8, rocks:12 },
  { id:'jungle', name:'Woodland', ground:'#3e6542', sky:'#bdcec7', trees:160, style:'broad' },
  { id:'canyon', name:'Quarry', ground:'#b47751', sky:'#dfcec2', rocks:110, hills:true },
  { id:'island', name:'Coastal sunrise', ground:'#d2c18a', sky:'#b9deeb', water:true, trees:35, style:'palm' },
  { id:'airport', name:'Airport', ground:'#838b79', sky:'#ccdbe3', runway:true, buildings:8 },
  { id:'wetlands', name:'Riverbank', ground:'#6f7950', sky:'#ccd6ce', water:true, trees:45 },
  { id:'tundra', name:'Hilltop', ground:'#a6a897', sky:'#cbd2db', rocks:50, hills:true },
  { id:'savanna', name:'Valley at dawn', ground:'#b5a271', sky:'#ded7bd', trees:32, style:'broad' },
  { id:'volcanic', name:'Scorched grassland', ground:'#55514e', sky:'#aaa9a9', rocks:90, hills:true },
];
export const objectTypes = Object.keys(droneModels);
export const objectLabels = Object.values(droneModels).map(model=>model.name);
export function random(seed) {
  let value = Number(seed) >>> 0;
  return () => { value += 0x6D2B79F5; let t=value; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function validateSettings(settings) {
  if(settings.hdriResolution&&settings.hdriResolution!=='2k')throw new Error('Only 2K panoramas are supported.');
  if(settings.backgroundMode&&settings.backgroundMode!=='hdri')throw new Error('Only photographic panoramas are supported.');
  if(settings.objects)for(const type of settings.types)validateObjectSettings(type,settings.objects[type]);
  if (!environments.some(e=>e.id===settings.environment)) throw new Error('Choose an environment.');
  if (settings.types.some(t=>!objectTypes.includes(t))) throw new Error('Unknown flying object.');
  if (settings.count<settings.types.length) throw new Error('Use at least one object for each selected type.');
  if (!settings.types.length) throw new Error('Select at least one flying object.');
  if (!Number.isInteger(settings.count)||settings.count<1||settings.count>30) throw new Error('Objects per image must be between 1 and 30.');
}
