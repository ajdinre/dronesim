import { droneModels } from './model-catalog.js';
import { environments } from './config.js';
import { panoramas } from './assets.js';
export function attributionDialog(){
  return `<dialog id="attributions"><div class="dialog-heading"><h2>Attributions</h2><button id="close-attributions">Close</button></div>
  <h3>Drone models</h3><ul>${Object.values(droneModels).map(model=>`<li><a href="${model.source}" target="_blank" rel="noreferrer">${model.name}</a> by ${model.author} · <a href="${model.licenseUrl}" target="_blank" rel="noreferrer">${model.license}</a><p>Distributed by <a href="${model.distributor}" target="_blank" rel="noreferrer">OpenAirTwin</a>. ${model.changes}</p></li>`).join('')}</ul>
  <h3>Photographic panoramas</h3><ul>${environments.map(env=>`<li><a href="https://polyhaven.com/a/${panoramas[env.id]}" target="_blank" rel="noreferrer">${env.name} · ${panoramas[env.id].replaceAll('_',' ')}</a> · Poly Haven · <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a></li>`).join('')}</ul>
  <h3>Software</h3><ul>${[
    ['Three.js','https://github.com/mrdoob/three.js','MIT'],
    ['Draco','https://github.com/google/draco','Apache 2.0'],
    ['Basis Universal','https://github.com/BinomialLLC/basis_universal','Apache 2.0'],
    ['Meshoptimizer','https://github.com/zeux/meshoptimizer','MIT'],
    ['Vite','https://github.com/vitejs/vite','MIT'],
  ].map(([name,url,license])=>`<li><a href="${url}" target="_blank" rel="noreferrer">${name}</a> · ${license}</li>`).join('')}</ul></dialog>`;
}
