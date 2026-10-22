const decoder=new TextDecoder(),encoder=new TextEncoder();
const align=value=>(value+3)&~3;

async function optimizeImage(bytes,mimeType){
  if(typeof createImageBitmap!=='function')return null;
  const image=await createImageBitmap(new Blob([bytes],{type:mimeType}));
  try{
    const scale=Math.min(1,2048/Math.max(image.width,image.height));
    const canvas=new OffscreenCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await canvas.convertToBlob({type:'image/webp',quality:0.94});
    if(blob.type!=='image/webp'||blob.size>=bytes.length*0.95)return null;
    return {bytes:new Uint8Array(await blob.arrayBuffer()),mimeType:'image/webp'};
  }finally{image.close();}
}

export async function optimizeModel(buffer,{imageOptimizer=optimizeImage}={}){
  const view=new DataView(buffer);
  if(buffer.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('Invalid GLB model.');
  const chunks=[];let offset=12;
  while(offset<buffer.byteLength){const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);if(offset+8+size>buffer.byteLength)throw new Error('Truncated GLB model.');chunks.push({type,bytes:new Uint8Array(buffer,offset+8,size)});offset+=8+size;}
  const jsonChunk=chunks.find(c=>c.type===0x4e4f534a),binChunk=chunks.find(c=>c.type===0x004e4942);
  if(!jsonChunk||!binChunk)return buffer;
  const gltf=JSON.parse(decoder.decode(jsonChunk.bytes));
  if(gltf.buffers?.length!==1||!gltf.bufferViews?.length)return buffer;
  const colorImages=new Set(),dataImages=new Set();
  const imageOf=info=>gltf.textures?.[info?.index]?.source;
  for(const material of gltf.materials||[]){
    for(const info of [material.pbrMetallicRoughness?.baseColorTexture,material.emissiveTexture]){const image=imageOf(info);if(image!==undefined)colorImages.add(image);}
    for(const info of [material.normalTexture,material.occlusionTexture,material.pbrMetallicRoughness?.metallicRoughnessTexture]){const image=imageOf(info);if(image!==undefined)dataImages.add(image);}
  }
  const replacements=new Map();
  for(const imageIndex of colorImages){
    if(dataImages.has(imageIndex))continue;
    const image=gltf.images?.[imageIndex],source=gltf.bufferViews[image?.bufferView];
    if(!source||source.buffer!==0||!['image/png','image/jpeg'].includes(image.mimeType))continue;
    const bytes=binChunk.bytes.subarray(source.byteOffset||0,(source.byteOffset||0)+source.byteLength);
    let optimized;try{optimized=await imageOptimizer(bytes,image.mimeType);}catch{continue;}
    if(optimized&&optimized.bytes.length<bytes.length){replacements.set(image.bufferView,optimized.bytes);image.mimeType=optimized.mimeType;}
  }
  if(!replacements.size)return buffer;
  for(const texture of gltf.textures||[])if(gltf.images?.[texture.source]?.mimeType==='image/webp'){
    texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;
    gltf.extensionsUsed=[...new Set([...(gltf.extensionsUsed||[]),'EXT_texture_webp'])];
    gltf.extensionsRequired=[...new Set([...(gltf.extensionsRequired||[]),'EXT_texture_webp'])];
  }
  let length=0;const parts=gltf.bufferViews.map((entry,index)=>{
    if(entry.buffer!==0)throw new Error('Unsupported external model buffer.');
    const bytes=replacements.get(index)||binChunk.bytes.subarray(entry.byteOffset||0,(entry.byteOffset||0)+entry.byteLength);
    entry.byteOffset=length;entry.byteLength=bytes.length;length+=align(bytes.length);return {offset:entry.byteOffset,bytes};
  });
  const bin=new Uint8Array(length);for(const part of parts)bin.set(part.bytes,part.offset);gltf.buffers[0].byteLength=length;
  const json=encoder.encode(JSON.stringify(gltf)),paddedJson=new Uint8Array(align(json.length)).fill(32);paddedJson.set(json);
  const outputChunks=chunks.map(chunk=>chunk.type===0x4e4f534a?{...chunk,bytes:paddedJson}:chunk.type===0x004e4942?{...chunk,bytes:bin}:chunk);
  const output=new ArrayBuffer(12+outputChunks.reduce((sum,c)=>sum+8+align(c.bytes.length),0)),out=new DataView(output),bytes=new Uint8Array(output);
  out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,output.byteLength,true);offset=12;
  for(const chunk of outputChunks){out.setUint32(offset,align(chunk.bytes.length),true);out.setUint32(offset+4,chunk.type,true);bytes.set(chunk.bytes,offset+8);offset+=8+align(chunk.bytes.length);}
  return output.byteLength<buffer.byteLength?output:buffer;
}
