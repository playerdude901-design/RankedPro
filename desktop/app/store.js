'use strict';
const fs=require('node:fs');const path=require('node:path');
function validate(d){
  if(!d||d.schema!==1||typeof d.name!=='string'||!Number.isFinite(d.xp)||d.xp<0||d.xp>1e12||!d.profile||typeof d.profile!=='object'||Array.isArray(d.profile))throw Error('Este archivo no es un respaldo válido de Ranked Pro');
  for(const k of ['owned','chests','sessions','events','posts'])if(!Array.isArray(d[k]))throw Error('Respaldo incompleto: '+k);
  for(const k of ['settings','projectInfo'])if(!d[k]||typeof d[k]!=='object'||Array.isArray(d[k]))throw Error('Respaldo incompleto: '+k);
  if(!Number.isFinite(d.spent)||d.spent<0)throw Error('Saldo inválido');
  const defaults=require('./lib/game').newProfile();
  for(const [k,v] of Object.entries(defaults))if(k in d.profile){const x=d.profile[k];if(Array.isArray(v)?!Array.isArray(x):v===null?(x!==null&&!Array.isArray(x)):typeof v==='object'?(!x||typeof x!=='object'||Array.isArray(x)):typeof x!==typeof v||typeof x==='number'&&!Number.isFinite(x))throw Error('Campo de perfil inválido: '+k);}
  for(const k of ['sessions','events','posts'])if(d[k].some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Lista inválida: '+k);
  if(d.media!==undefined&&(!Array.isArray(d.media)||d.media.some(x=>!x||typeof x.file!=='string'||typeof x.name!=='string')))throw Error('Galería inválida');
  const raw=JSON.stringify(d);if(raw.length>20e6||/"(?:__proto__|constructor|prototype)"\s*:/.test(raw))throw Error('Respaldo no admitido');
  return d;
}
class Store{
 constructor(dir){fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,'profile.json');this.warning='';}
 load(){for(const f of [this.file,this.file+'.bak']){try{if(fs.existsSync(f)){const d=validate(JSON.parse(fs.readFileSync(f,'utf8')));if(f.endsWith('.bak'))this.warning='Se recuperó la copia de seguridad del perfil.';return d;}}catch(e){this.warning='No se pudo leer el perfil: '+e.message;}}
  if(fs.existsSync(this.file))throw Error('El perfil y su respaldo no se pueden leer. Se conservaron sin cambios en '+path.dirname(this.file));return {};
 }
 save(data){validate(data);const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),'utf8');if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.bak');fs.renameSync(tmp,this.file);}
}
module.exports={Store,validate};
