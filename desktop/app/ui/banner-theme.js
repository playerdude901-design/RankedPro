'use strict';
// Sample only when the selected image changes; never decode on the tracking tick.
window.BannerTheme=(()=>{
 const cache=new Map();let current='',generation=0;
 const fallback='#9456d8';
 function histogram(pixels,bins,weight=1){for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.1)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2];const key=(r>>5)*64+(g>>5)*8+(b>>5);const bin=bins.get(key)||[0,0,0,0];const w=alpha*weight;bin[0]+=w;bin[1]+=r*w;bin[2]+=g*w;bin[3]+=b*w;bins.set(key,bin);}}
 function dominant(bins){if(!bins.size)return fallback;const best=[...bins.values()].sort((a,b)=>b[0]-a[0])[0];return '#'+best.slice(1).map(v=>Math.round(v/best[0]).toString(16).padStart(2,'0')).join('');}
 function sample(source,bins,weight=1){const canvas=document.createElement('canvas');canvas.width=64;canvas.height=40;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,64,40);histogram(ctx.getImageData(0,0,64,40).data,bins,weight);}
 async function extract(url){const bins=new Map();
  if(url.startsWith('data:image/gif;base64,')&&typeof ImageDecoder!=='undefined'){
   let decoder;
   try{const bytes=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));decoder=new ImageDecoder({data:bytes,type:'image/gif'});await decoder.tracks.ready;const count=decoder.tracks.selectedTrack.frameCount;const samples=Math.min(12,count);for(let i=0;i<samples;i++){const index=Math.floor(i*count/samples);const {image}=await decoder.decode({frameIndex:index});try{sample(image,bins,Math.max(1,image.duration||100000));}finally{image.close();}}return dominant(bins);}catch{bins.clear();}finally{decoder?.close();}
  }
  const img=new Image();img.src=url;await img.decode();sample(img,bins);return dominant(bins);
 }
 async function apply(url){url=url||'';if(url===current)return;current=url;const ticket=++generation;
  if(!url){document.body.style.setProperty('--banner-tone',fallback);return;}
  // Retain just a few selections, including at most a few user GIF strings.
  if(!cache.has(url)){if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(url,extract(url).catch(()=>fallback));}
  const color=await cache.get(url);if(ticket===generation)document.body.style.setProperty('--banner-tone',color);
 }
 return {apply,extract,histogram,dominant};
})();
