'use strict';
const {desktopCapturer,dialog,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const KINDS=new Set(['avatar','bannerGif','mediaImport','mediaSources','mediaScreenshot','mediaRecordSelect','mediaRecordSave','mediaRecordCancel','mediaExport']);
class MediaLibrary{
 constructor(dir,getEngine){this.dir=path.join(dir,'media');fs.mkdirSync(this.dir,{recursive:true});this.engine=getEngine;this.selection=null;this.recording=false;this.stopTimer=null;}
 bind(window){
  window.webContents.session.setDisplayMediaRequestHandler((request,callback)=>{
   if(!this.selection||Date.now()-this.selection.at>15000||request.frame!==window.webContents.mainFrame){callback({});return;}
   const picked=this.selection;this.selection=null;this.recording=true;
   this.stopTimer=setTimeout(()=>{if(!window.isDestroyed())window.webContents.send('stop-recording');},61000);
   callback({video:picked.source,...(picked.audio?{audio:'loopback'}:{})});
  });
 }
 list(){return (this.engine().data.media||[]).filter(m=>/^[a-f0-9-]+\.(png|jpg|jpeg|webp|mp4|webm|mov)$/.test(m.file)).map(m=>({...m,url:pathToFileURL(path.join(this.dir,m.file)).href,exists:fs.existsSync(path.join(this.dir,m.file))}));}
 add(buffer,ext,name){const file=crypto.randomUUID()+ext;fs.writeFileSync(path.join(this.dir,file),buffer);const item={id:crypto.randomUUID(),file,name:name.slice(0,100),at:Date.now(),kind:/\.(png|jpg|jpeg|webp)$/.test(ext)?'image':'video'};const data=this.engine().data;data.media||=[];data.media.unshift(item);return item;}
 async sources(){return (await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:320,height:180}})).sort((a,b)=>Number(/premiere/i.test(b.name))-Number(/premiere/i.test(a.name)));}
 async handle(kind,value,window){
  if(kind==='bannerGif'){
   if(this.engine().data.xp<1000000)throw Error('Desbloquea Radiante para usar GIF en el banner');
   const r=await dialog.showOpenDialog(window,{title:'Elegir GIF para el banner',properties:['openFile'],filters:[{name:'GIF',extensions:['gif']}]});if(r.canceled)return {};
   const b=fs.readFileSync(r.filePaths[0]);if(b.length>5e6||!['GIF87a','GIF89a'].includes(b.subarray(0,6).toString()))throw Error('GIF inválido o mayor de 5 MB');this.engine().data.bannerGif='data:image/gif;base64,'+b.toString('base64');return {};
  }
  if(kind==='avatar'){
   const result=await dialog.showOpenDialog(window,{title:'Elegir foto de perfil',properties:['openFile'],filters:[{name:'Imagen',extensions:['png','jpg','jpeg','webp','gif']}]});if(result.canceled)return {};
   if(path.extname(result.filePaths[0]).toLowerCase()==='.gif'){if(this.engine().data.xp<250000)throw Error('Desbloquea Diamante para usar GIF de perfil');const b=fs.readFileSync(result.filePaths[0]);if(b.length>5e6||!['GIF87a','GIF89a'].includes(b.subarray(0,6).toString()))throw Error('GIF inválido o mayor de 5 MB');this.engine().game.P.Avatar='data:image/gif;base64,'+b.toString('base64');return {};}
   if(fs.statSync(result.filePaths[0]).size>15e6)throw Error('La imagen debe pesar menos de 15 MB');const img=nativeImage.createFromPath(result.filePaths[0]);if(img.isEmpty())throw Error('Imagen no compatible');this.engine().game.P.Avatar=img.resize({width:256,height:256,quality:'good'}).toDataURL();return {};
  }
  if(kind==='mediaImport'){
   const result=await dialog.showOpenDialog(window,{title:'AÃ±adir imagen o vÃ­deo a tu galerÃ­a local',properties:['openFile'],filters:[{name:'Imagen o vÃ­deo',extensions:['png','jpg','jpeg','webp','mp4','webm','mov']}]});if(result.canceled)return {};
   const file=result.filePaths[0],ext=path.extname(file).toLowerCase();if(!['.png','.jpg','.jpeg','.webp','.mp4','.webm','.mov'].includes(ext))throw Error('Formato no compatible');if(fs.statSync(file).size>250e6)throw Error('MÃ¡ximo 250 MB por archivo');const dest=crypto.randomUUID()+ext;fs.copyFileSync(file,path.join(this.dir,dest));const data=this.engine().data;data.media||=[];data.media.unshift({id:crypto.randomUUID(),file:dest,name:path.basename(file),at:Date.now(),kind:/\.(png|jpg|jpeg|webp)$/.test(ext)?'image':'video'});return {};
  }
  if(kind==='mediaSources')return {sources:(await this.sources()).map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL()}))};
  if(kind==='mediaRecordSelect'){
   if(this.recording)throw Error('Ya hay una grabaciÃ³n en curso');const sources=await this.sources(),source=sources.find(s=>s.id===value.id);if(!source)throw Error('La ventana ya no estÃ¡ disponible');this.selection={source,at:Date.now(),audio:value.audio===true};return {};
  }
  if(kind==='mediaScreenshot'){
   const sources=await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:1920,height:1080}}),source=sources.find(s=>s.id===value);if(!source||source.thumbnail.isEmpty())throw Error('No se pudo capturar esta ventana');this.add(source.thumbnail.toPNG(),'.png','Captura Â· '+source.name);return {};
  }
  if(kind==='mediaRecordSave'){
   if(!this.recording)throw Error('No hay grabaciÃ³n activa');this.recording=false;clearTimeout(this.stopTimer);const buf=Buffer.from(value);if(buf.length<1||buf.length>40e6)throw Error('GrabaciÃ³n vacÃ­a o demasiado grande');this.add(buf,'.webm','GrabaciÃ³n Â· '+new Date().toLocaleString('es-MX'));return {};
  }
  if(kind==='mediaRecordCancel'){this.recording=false;this.selection=null;clearTimeout(this.stopTimer);return {};}
  if(kind==='mediaExport'){
   const item=this.list().find(m=>m.id===value);if(!item||!item.exists)throw Error('Archivo no encontrado');const result=await dialog.showSaveDialog(window,{defaultPath:item.file,filters:[{name:'Archivo multimedia',extensions:[path.extname(item.file).slice(1)]}]});if(!result.canceled)fs.copyFileSync(path.join(this.dir,item.file),result.filePath);return {};
  }
 }
}
module.exports={MediaLibrary,KINDS};
