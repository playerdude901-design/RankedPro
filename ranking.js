'use strict';
async function refresh(){
 const status=document.querySelector('#status'), button=document.querySelector('button');
 button.disabled=true;
 try{
  const config=await (await fetch('config.json')).json();
  if(!config.url){status.textContent='El ranking todavía no está conectado.';return;}
  const response=await fetch(config.url+'/rest/v1/rpc/editor_ranking',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error();
  const rows=await response.json(), body=document.querySelector('tbody');
  body.replaceChildren();
  for(const entry of rows){
   const row=body.insertRow();
   for(const value of [entry.position,entry.nickname,Math.floor(entry.seconds/3600)+' h '+Math.floor(entry.seconds%3600/60)+' min'])row.insertCell().textContent=value;
  }
  status.textContent=rows.length?'':'Todavía no hay editores registrados.';
 }catch{status.textContent='No se pudo actualizar la clasificación.';}finally{button.disabled=false;}
}
document.querySelector('button').onclick=refresh;
refresh();
