'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

const confirmQuery='?redirect_to='+encodeURIComponent('https://playerdude901-design.github.io/RankedPro/');

class Social {
 constructor(dir,vault,config){
  this.file=path.join(dir,'social-session.bin');
  this.vault=vault;
  this.config=config;
  this.data={accounts:{}};
  if(fs.existsSync(this.file))this.data=JSON.parse(vault.decryptString(fs.readFileSync(this.file)));
  this.rows=[];this.inbox={messages:[]};this.upgraded=false;
  this.error='';
 }
 get ready(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(this.config.url)&&Boolean(this.config.publishableKey);}
 get session(){return this.data.session;}
 get account(){return this.session&&this.data.accounts[this.session.user.id];}
 view(){return {ready:this.ready,name:this.session?.user.user_metadata?.nickname,logged:!!this.session,rows:this.rows,inbox:this.inbox,upgraded:this.upgraded,error:this.error};}
 save(){
  const bytes=this.vault.encryptString(JSON.stringify(this.data));
  fs.writeFileSync(this.file+'.tmp',bytes);
  fs.renameSync(this.file+'.tmp',this.file);
 }
 async api(route,body,token){
  const response=await fetch(this.config.url+route,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{apikey:this.config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const text=await response.text(), result=text?JSON.parse(text):null;
  if(!response.ok)throw Error(result?.msg||result?.message||result?.error_description||'No se pudo conectar al ranking.');
  return result;
 }
 remember(result){
  this.data.session={user:{id:result.user.id,user_metadata:{nickname:result.user.user_metadata?.nickname}},access_token:result.access_token,refresh_token:result.refresh_token,expires_at:result.expires_at};
  this.data.accounts[result.user.id] ||= {device:randomUUID(),total:0};
  this.save();
 }
 async run(kind,value={}){
  if(!this.ready)throw Error('Configura el proyecto de Supabase para activar Social.');
  if(this.busy)throw Error('Sincronización en curso. Inténtalo en unos segundos.');
  this.busy=true;
  try{
   this.error='';
   if(kind==='logout'){delete this.data.session;this.rows=[];this.save();return;}
   if(kind==='resend'){
    await this.api('/auth/v1/resend'+confirmQuery,{type:'signup',email:value.email.trim()});
    return {confirmation:true};
   }
   if(kind==='signup'||kind==='login'){
    if(this.session)throw Error('Ya hay una sesión iniciada.');
    if(!this.vault.isEncryptionAvailable())throw Error('Windows no pudo proteger la sesión.');
    const body={email:value.email.trim(),password:value.password};
    if(kind==='signup')body.data={nickname:value.nickname.trim()};
    const result=await this.api('/auth/v1/'+(kind==='signup'?'signup'+confirmQuery:'token?grant_type=password'),body);
    if(!result.access_token)return {confirmation:true};
    this.remember(result);
   }
   if(!this.session)return;
   if(this.session.expires_at*1000<Date.now()+60000)this.remember(await this.api('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token}));
   const token=this.session.access_token;
   await this.api('/rest/v1/rpc/submit_edit_time',{device_id:this.account.device,device_total:this.account.total},token);

   try{
    const appearance=this.getAppearance?.();
    if(appearance)await this.api('/rest/v1/rpc/publish_editor',{appearance_data:appearance},token);
    if(kind==='follow')await this.api('/rest/v1/rpc/toggle_rival',{target_id:value.id,following:value.following},token);
    if(kind==='message')await this.api('/rest/v1/rpc/send_editor_message',{target_id:value.id,message_body:value.body},token);
    this.rows=await this.api('/rest/v1/rpc/editor_ranking_v2',{},token);
    this.inbox=await this.api('/rest/v1/rpc/social_inbox',{},token);
    this.upgraded=true;
    const mine=this.rows.find(r=>r.mine);
    if(mine){
     const previous=this.account.rivalGaps||{}, gaps={};
     for(const rival of this.rows.filter(r=>r.following)){
      gaps[rival.id]=Number(mine.seconds)-Number(rival.seconds);
      if(previous[rival.id]<=0&&gaps[rival.id]>0)this.account.passedRival=true;
     }
     this.account.rivalGaps=gaps;
     this.inbox.passedRival=Boolean(this.account.passedRival);
     this.save();
    }
    this.onSocial?.(this.inbox,this.rows);
   }catch(e){
    if(!/PGRST202|schema cache|Could not find the function/.test(e.message))throw e;
    this.rows=await this.api('/rest/v1/rpc/editor_ranking',{},token);
    this.upgraded=false;
    if(kind==='follow'||kind==='message')throw Error('Las funciones sociales esperan la actualizaci?n del servidor.');
   }
  }catch(e){this.error=e.message;throw e;}finally{this.busy=false;}
 }
}
module.exports={Social};
