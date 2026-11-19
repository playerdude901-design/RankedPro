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
 if(entry.id==='18edd5dd-9a86-4242-b9d6-9f9ce919170b'){const badge=new Image();badge.src='assets/creator-verified.gif';badge.className='creator-verified';badge.alt='Creador de Ranked Pro verificado';badge.title='Creador de Ranked Pro';info.append(badge);}

 if(/^[A-Z]{2}$/.test(a.country||'')){
  const flag=new Image();flag.src='assets/flags/'+a.country+'.png';flag.className='public-country-flag';
  let label=a.country;try{label=new Intl.DisplayNames(['es'],{type:'region'}).of(a.country);}catch{}
  flag.alt=label;flag.title=label;flag.loading='lazy';info.append(flag);
 }

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
 const editorIcon=new Image();editorIcon.src='assets/'+(a.editor==='capcut'?'capcut.svg':'premiere-pro.svg');editorIcon.alt=a.editor==='capcut'?'CapCut':'Premiere Pro';editorIcon.className='public-editor-icon';info.append(editorIcon);
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
  const ranks=[['IRON',0,'#9aa0a8'],['BRONZE',2500,'#d0884f'],['SILVER',10000,'#d6dee8'],['GOLD',35000,'#f5c542'],['PLATINUM',100000,'#4fd8c9'],['DIAMOND',250000,'#7cc8ff'],['ASCENDANT',500000,'#b98cff'],['IMMORTAL',750000,'#c24bff'],['RADIANT',1000000,'#f45b58']];
  const known=typeof entry.appearance?.xp==='number'&&Number.isFinite(entry.appearance.xp),xp=known?Math.max(0,entry.appearance.xp):0;
  const rank=[...ranks].reverse().find(r=>xp>=r[1]),max=Math.max(1,...rows.map(r=>Number(r.appearance?.xp)||0));
  const progress=document.createElement('div');progress.className='rank-progress-row';
  const track=document.createElement('div');track.className='rank-progress-track';
  const fill=document.createElement('div');fill.className='rank-progress-fill';fill.style.width=(known?Math.max(8,xp/max*100):8)+'%';fill.style.setProperty('--rank-tone',known?rank[2]:'#747780');
  if(known){const emblem=new Image();emblem.src='assets/ranks/'+rank[0].toLowerCase()+'.svg';emblem.alt='';emblem.className='rank-progress-icon';fill.append(emblem);}
  const label=document.createElement('span');label.textContent=known?rank[0]:'—';fill.append(label);track.append(fill);
  const value=document.createElement('div');value.className='rank-progress-value';const total=document.createElement('strong');total.textContent=known?Math.floor(xp).toLocaleString('es-MX')+' XP':'XP pendiente';const time=document.createElement('small');time.textContent=formatTime(entry.seconds);value.append(total,time);progress.append(track,value);row.insertCell().append(progress);

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
