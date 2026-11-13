'use strict';
const statusLine=document.querySelector('#status');
const button=document.querySelector('#refresh');
function formatTime(seconds){
 const hours=Math.floor(seconds/3600);
 const minutes=Math.floor(seconds%3600/60);
 return hours?hours+' h '+minutes+' min':minutes?minutes+' min':seconds+' s';
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
  row.insertCell().textContent=entry.nickname;
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
  const response=await fetch(config.url+'/rest/v1/rpc/editor_ranking',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}'});
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
