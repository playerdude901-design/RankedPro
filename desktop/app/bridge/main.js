'use strict';
const ppro=require('premierepro'),{entrypoints}=require('uxp'),config=require('./config.js');
const C=ppro.Constants||{},EM=ppro.EventManager;
const root='http://localhost:'+config.port;
const instance=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let seq=0,timer=null,busy=false,project=null,sequence=null,projectId='',sequenceId='',lastPos=null,lastAt=0,scanAt=0,dirty=true,renderAt=0,visible=true;
let events=[],pending=null,hooked=[],globals=[],capabilities=[],lastMessage='';
let projectReadyAt=0,leaderboardAt=0;
const state={project:'',name:'',sequence:'',playing:false,exporting:false,error:'',capabilities};
function status(text){if(text===lastMessage)return;lastMessage=text;if(visible){const el=document.getElementById('status');if(el)el.textContent=text;}}
async function leaderboard(){
 try{const data=await request('/leaderboard');const list=document.getElementById('leaderboard'),empty=document.getElementById('leaderboard-empty');if(!list)return;list.replaceChildren();for(const row of data.rows||[]){const li=document.createElement('li'),place=document.createElement('b'),name=document.createElement('span'),time=document.createElement('small');place.textContent='#'+row.position;name.textContent=row.nickname;time.textContent=(Number(row.seconds||0)/3600).toFixed(1)+' h';li.append(place,name,time);list.append(li);}empty.hidden=!!data.rows?.length;empty.textContent=data.ready?'Todavía no hay editores en la clasificación.':'Inicia sesión en Social dentro de Ranked Pro para ver la clasificación.';}catch{const empty=document.getElementById('leaderboard-empty');if(empty){empty.hidden=false;empty.textContent='Abre Ranked Pro para cargar la clasificación.';}}
}
if(typeof document!=='undefined'){const refresh=document.getElementById('refresh');if(refresh)refresh.onclick=leaderboard;leaderboard();}
async function request(url,body){
 const options={method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.token}};
 if(body){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
 const r=await fetch(root+url,options);if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}
function push(kind,extra){if(events.length>=80)return;events.push(Object.assign({kind},extra||{}));}
function listen(target,family,key,fn){const name=C[family]&&C[family][key];if(!name||!target)return;try{EM.addEventListener(target,name,fn,false);hooked.push([target,name,fn]);if(!capabilities.includes(family+'.'+key))capabilities.push(family+'.'+key);}catch{}}
function clearHooks(){for(const [t,n,f]of hooked){try{EM.removeEventListener(t,n,f,false);}catch{}}hooked=[];}
function renderEvent(key){
 if(key==='RENDER_PROGRESS'){if(!renderAt)renderAt=Date.now();state.exporting=true;}
 else if(key==='RENDER_COMPLETE'){push('render',{ms:renderAt?Date.now()-renderAt:0});renderAt=0;state.exporting=false;}
 else if(key==='RENDER_CANCEL'||key==='RENDER_ERROR'){renderAt=0;state.exporting=false;}
}
// A few global events, not every event from every family. Remove them on destroy.
for(const [family,key,fn]of [
 ['OperationCompleteEvent','EFFECT_DROP_COMPLETE',()=>push('fx')],
 ['VideoTrackEvent','TRACK_CHANGED',()=>{dirty=true;if(!events.some(e=>e.kind==='trim'))push('trim');}],
 ['AudioTrackEvent','TRACK_CHANGED',()=>{dirty=true;if(!events.some(e=>e.kind==='trim'))push('trim');}],
 ['ProjectEvent','DIRTY',()=>{dirty=true;}],
 ['OperationCompleteEvent','EXPORT_MEDIA_COMPLETE',()=>{push('render',{ms:renderAt?Date.now()-renderAt:0});renderAt=0;state.exporting=false;}],
 ...['RENDER_PROGRESS','RENDER_COMPLETE','RENDER_CANCEL','RENDER_ERROR'].map(k=>['EncoderEvent',k,()=>renderEvent(k)])
]){const n=C[family]&&C[family][key];if(n){try{EM.addGlobalEventListener(n,fn,false);globals.push([n,fn]);capabilities.push(family+'.'+key);}catch{}}}
async function context(){
 let next=await ppro.Project.getActiveProject();
 const id=next?String(next.guid||next.path||next.name):'';
 if(id!==projectId){clearHooks();project=next;projectId=id;sequence=null;sequenceId='';lastPos=null;state.project=next?String(next.path||next.guid||next.name):'';state.name=next?String(next.name||'Proyecto sin título'):'';dirty=true;projectReadyAt=Date.now()+20000;
 }
 if(!project){state.sequence='';state.playing=false;return;}
 if(Date.now()<projectReadyAt)return;
 const nextSequence=await project.getActiveSequence(),id2=nextSequence?String(nextSequence.guid||nextSequence.name):'';
 if(id2!==sequenceId){
   // Project listener is reattached alongside the new sequence, avoiding stale track listeners.
   clearHooks();
   sequence=nextSequence;sequenceId=id2;state.sequence=sequence?String(sequence.name||'Secuencia'):'';dirty=true;lastPos=null;
   // Global track events avoid attaching dozens of native listeners during project load.
 }
 if(sequence){const t=await sequence.getPlayerPosition();const pos=t?(t.seconds!=null?Number(t.seconds):Number(t.ticksNumber||t.ticks||0)/254016000000):0;const now=Date.now(),dt=(now-lastAt)/1000;state.playing=lastPos!=null&&dt>0&&(pos-lastPos)/dt>0.3&&(pos-lastPos)/dt<1.7;lastPos=pos;lastAt=now;}
}
async function snapshot(){
 if(!sequence)return;let clips=0,aclips=0;const v=await sequence.getVideoTrackCount(),a=await sequence.getAudioTrackCount();
 // Large sequences keep time tracking, but skip the costly clip enumeration.
 if(v+a>40){state.error='Secuencia grande: conteo de clips omitido para cuidar el rendimiento.';return;}
 const type=C.TrackItemType?.CLIP ?? 1;
 for(let i=0;i<v;i++){const track=await sequence.getVideoTrack(i);clips+=(await track.getTrackItems(type,false)).length;}
 for(let i=0;i<a;i++){const track=await sequence.getAudioTrack(i);aclips+=(await track.getTrackItems(type,false)).length;}
 const end=await sequence.getEndTime();const minutes=end?(end.seconds!=null?Number(end.seconds):Number(end.ticksNumber||end.ticks||0)/254016000000)/60:0;
 push('snapshot',{snap:{clips,aclips,tracks:v+a,vtracks:v,minutes}});dirty=false;
}
async function loop(){
 if(busy)return;busy=true;let delay=3000;
 try{
   const health=await request('/health');
   if(health.scan){try{state.error='';await context();if(health.snapshot&&dirty&&!state.playing&&!state.exporting&&Date.now()-scanAt>=15000){scanAt=Date.now();await snapshot();}}catch(e){state.error=String(e.message||e).slice(0,300);}}
   else {state.playing=false;delay=5000;}
   if(!pending){pending={instance,seq:++seq,state:Object.assign({},state),events};events=[];}
   await request('/events',pending);pending=null;
   status(state.error?'Puente activo · '+state.error:'Puente activo · '+(state.name||'sin proyecto abierto'));if(visible&&Date.now()-leaderboardAt>30000){leaderboardAt=Date.now();leaderboard();}
 }catch(e){status('Sin conexión: '+String(e.message||e).slice(0,180));console.warn('Ranked Pro Bridge: '+String(e.message||e));delay=5000;}
 finally{busy=false;timer=setTimeout(loop,delay);}
}
entrypoints.setup({panels:{bridge:{show(){visible=true;lastMessage='';status('Puente activo · comunicación local');},hide(){visible=false;}}},plugin:{create(){},destroy(){clearTimeout(timer);clearHooks();for(const[n,f]of globals){try{EM.removeGlobalEventListener(n,f,false);}catch{}}}}});
loop();
