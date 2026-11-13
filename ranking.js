'use strict';
const statusLine=document.querySelector('#status');
const button=document.querySelector('#refresh');
function formatTime(seconds){
 const hours=Math.floor(seconds/3600);
 const minutes=Math.floor(seconds%3600/60);
 return hours?hours+' h '+minutes+' min':minutes?minutes+' min':seconds+' s';
}
let cosmetics={badges:[],effects:[]};
function identity(entry,cell){
 const a=entry.appearance||{};
 const box=document.createElement('div');box.className='public-profile';
 if(typeof a.avatar==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.avatar)){
  const image=new Image();image.src=a.avatar;image.alt='';image.className='public-avatar';image.loading='lazy';box.append(image);
 }
 const info=document.createElement('div'),name=document.createElement('span');name.textContent=entry.nickname;
 if(cosmetics.effects.includes(a.namefx)){
  name.className='public-name';name.style.cssText=nameStyle(a.namefx);
  name.style.setProperty('--cycle',(1.15/Math.min(4,Math.max(.25,Number(a.speed)||1)))+'s');
 }
 info.append(name);
 const badges=document.createElement('div');badges.className='public-badges';
 const ids=Array.isArray(a.badges)?a.badges:[];
 const items=cosmetics.badges.filter(b=>ids.includes(b.id)).sort((a,b)=>b.reward-a.reward);
 for(const [i,badge] of items.entries()){
  const icon=document.createElement('span');icon.className='public-badge';
  icon.tabIndex=0;icon.setAttribute('role','img');
  const label=badge.name+' ? '+badge.description;
  icon.title=label;icon.setAttribute('aria-label',label);
  icon.style.setProperty('--badge',`url('badges/${encodeURIComponent(badge.id)}.png')`);
  const thresholds=[150,400,1000,1500,2999,Infinity],colors=['#a5afbf','#75ce97','#76b8ff','#e5de72','#ff807b','#f5ba49'];
  icon.style.color=colors[thresholds.findIndex(n=>badge.reward<=n)];
  icon.hidden=i>=6;badges.append(icon);
 }
 if(items.length>6){
  const button=document.createElement('button');button.textContent='+'+(items.length-6);button.setAttribute('aria-expanded','false');
  button.onclick=()=>{
   const expanded=button.getAttribute('aria-expanded')==='true';
   badges.querySelectorAll('.public-badge').forEach((b,i)=>b.hidden=i>=6&&expanded);
   button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'+'+(items.length-6):'Menos';
  };badges.append(button);
 }
 info.append(badges);box.append(info);cell.append(box);
}
function renderRows(rows){
 const fragment=document.createDocumentFragment();
 for(const entry of rows){
  const row=document.createElement('tr');
  if(entry.position<=3)row.dataset.place=entry.position;
  const place=document.createElement('span');
  place.className='place';
  place.textContent='#'+entry.position;
  row.insertCell().append(place);
  identity(entry,row.insertCell());
  row.insertCell().textContent=formatTime(entry.seconds);
  fragment.append(row);
 }
 document.querySelector('tbody').replaceChildren(fragment);
}
async function refresh(){
 button.disabled=true;
 try{
  const config=await (await fetch('config.json')).json();
  if(!config.url){statusLine.textContent='El ranking todavía no está conectado.';return;}
  cosmetics=await (await fetch('cosmetics.json')).json();
  let response=await fetch(config.url+'/rest/v1/rpc/editor_ranking_v2',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}'});
  if(response.status===404)response=await fetch(config.url+'/rest/v1/rpc/editor_ranking',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error();
  const rows=await response.json();
  renderRows(rows);
  const time=new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  document.querySelector('#updated').textContent='Actualizado a las '+time;
  statusLine.textContent=rows.length?'':'Todavía no hay editores registrados.';
 }catch{statusLine.textContent='No se pudo actualizar la clasificación. Inténtalo de nuevo.';}
 finally{button.disabled=false;}
}
button.onclick=refresh;
refresh();
