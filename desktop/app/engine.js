'use strict';
const crypto = require('node:crypto');
const R = require('./lib/rules');
const { Game, dayKey, POOL, DAILY, achCat, achTier } = require('./lib/game');
const Shop = require('./lib/shop');
const Titles = require('./lib/titles');
const Economy=require('./lib/economy');
const translations = require('./lib/i18n-table');
const T = (fr,en) => (translations[en]?.[0] || en || fr).replaceAll('VEGAS','Premiere').replaceAll('VISFX','Ranked Pro');
const SUPPORTED = new Set(['focus','session','night','days','edits','audioedits','trims','fx','tracks','saves','renders']);
const SOCIAL = new Set(['rival_beat','podium','country_top','social','influencer','visfx_trio','icebreaker','chatterbox','networker','popular','fair_play','duelist','gladiator','undefeated','high_roller','beat_natveg','recruiter','ambassador','founder','creator','gauntlet','showcase','recap_shared','first_post','content_creator','first_clip','showreel','gallery']);
const UNOBSERVABLE = new Set(['crash_100','keyframer','marker','arsenal','counter','undo_1000','fx_collector','ghost_render']);
const clamp = (v,min,max,def=min) => Number.isFinite(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : def;
class Engine {
  constructor(data={}, now=()=>Date.now()) {
    this.now=now;
    this.data=Object.assign({schema:1,id:crypto.randomUUID(),name:'Mi estudio',created:now(),xp:0,spent:0,bonusTokens:0,owned:[],chests:[],sessions:[],events:[],posts:[],projectInfo:{},settings:{},profile:{},session:null},data);
    this.data.settings=Object.assign({tray:true,startup:false,idleSeconds:60,notifications:true,sound:false,dailyMinutes:60,weeklyHours:10,hourlyRate:0,currency:'MXN',theme:'dark',nameSpeed:1},data.settings);
    this.game = new Game({profile:this.data.profile,now,serverXp:()=>this.data.xp,onXp:n=>{this.data.xp+=n;},onToast:t=>this.event(t.title,t.text,t.ach?'achievement':'reward',t.xp,t.ach)});
    // Keep the full achievement catalog visible, but don't award server-only / unobservable milestones.
    const ageMilestones=[
      [7,'Primera semana',100], [30,'Un mes en Ranked Pro',250],
      [90,'Tres meses en Ranked Pro',600], [180,'Medio año en Ranked Pro',1500]
    ];
    const accountAge=()=>Math.max(0,Math.floor((now()-this.data.created)/86400000));
    const tenure=ageMilestones.map(([days,name,reward])=>({
      id:'account_age_'+days,category:'tenure',glyph:0xE823,en:name,
      dEn:`Alcanza ${days} días de antigüedad desde la creación de tu perfil de Ranked Pro.`,
      goal:days,reward,v:accountAge
    }));
    const anniversaryNames=['Primer','Segundo','Tercer','Cuarto','Quinto','Sexto','Séptimo','Octavo','Noveno','Décimo'];
    const created=new Date(this.data.created);
    for(const [index,name] of anniversaryNames.entries()){
      const years=index+1;
      const anniversary=new Date(created);
      anniversary.setUTCFullYear(created.getUTCFullYear()+years);
      if(anniversary.getUTCMonth()!==created.getUTCMonth())anniversary.setUTCDate(0);
      tenure.push({
        id:'account_age_'+(365*years),category:'tenure',glyph:0xE823,en:name+' aniversario',
        dEn:`Cumple ${years} ${years===1?'año':'años'} con tu perfil de Ranked Pro.`,
        goal:(anniversary-created)/86400000,reward:1000*(years+1),v:accountAge
      });
    }
    this.catalog=[...this.game.ACH,...tenure];
    Economy.init(this);
    this.game.ACH=this.catalog.filter(a=>!SOCIAL.has(a.id)&&!UNOBSERVABLE.has(a.id));
    const validPool=POOL.filter(q=>SUPPORTED.has(q.stat));
    Object.defineProperty(this.game,'thisWeek',{get:()=>{
      const offset=((this.game.weekIndex%validPool.length)+validPool.length)%validPool.length;
      const chosen=[],seen=new Set();
      for(let i=0;i<validPool.length&&chosen.length<5;i++){const q=validPool[(i+offset)%validPool.length];if(!seen.has(q.stat)){chosen.push(q);seen.add(q.stat);}}
      return chosen;
    }});
    const daily=DAILY.filter(q=>SUPPORTED.has(q.stat));
    Object.defineProperty(this.game,'daily',{get:()=>daily[((this.game.dayIndex%daily.length)+daily.length)%daily.length]});
    this.game.P.HoursGoal=this.data.settings.weeklyHours;
    this.game.P.Owned=this.data.owned;
    this.game.xpFrac=Number.isFinite(this.data.xpFraction)?this.data.xpFraction:0;
    this.focus={premiere:false,idleMs:Infinity,at:0};
    this.bridge={at:0,project:'',name:'',sequence:'',playing:false,exporting:false,capabilities:[],error:''};
    this.paused=false; this.active=false; this.reason='Esperando Premiere'; this.carry=0; this.lastTick=now(); this.lastCheck=0; this.lastRender=0; this.seenPackets=new Map();
    if(this.data.session && now()-this.data.session.lastActive>900000) this.endSession();
  }
  event(title,text,type='info',xp=0,achievement='') {
    const e={id:crypto.randomUUID(),at:this.now(),title,text,type,xp,achievement};
    this.data.events.unshift(e); this.data.events.length=Math.min(this.data.events.length,300);
    if(this.onEvent) this.onEvent(e);
  }
  sample(value){this.focus={premiere:value.premiere===true,pid:value.pid,idleMs:clamp(value.idleMs,0,4294967295,4294967295),at:this.now()};}
  get connected(){return this.now()-this.bridge.at<12000 && this.bridge.at>0;}
  tick(){
    const now=this.now(), dt=(now-this.lastTick)/1000; this.lastTick=now;
    const s=this.data.settings, fresh=now-this.focus.at<1800;
    this.reason=this.paused?'Pausado manualmente':!fresh?'Detector de Windows desconectado':!this.focus.premiere?'Premiere fuera de foco':this.focus.idleMs>s.idleSeconds*1000?'Pausa por inactividad':this.connected&&this.bridge.exporting?'Exportación en curso':'Editando en Premiere';
    this.active=this.reason==='Editando en Premiere';
    // Never catch up sleep, a stalled event loop, or time before a foreground transition.
    if(this.active && this.wasActive && dt>0 && dt<=2.5) this.carry+=dt; else this.carry=0;
    this.wasActive=this.active;
    while(this.carry>=1){this.carry--;this.second();}
    if(this.data.session && now-this.data.session.lastActive>=900000)this.endSession();
    if(now-this.lastCheck>=5000){this.lastCheck=now;this.game.check(T);Economy.check(this);}
  }
  second(){
    const now=this.now(), before=R.rankIndex(this.data.xp);
    if(!this.data.session){this.data.session={id:crypto.randomUUID(),start:now,lastActive:now,seconds:0,xp:0,money:0,counted:false};this.game.sessionStarted();}
    const session=this.data.session; session.seconds++;session.lastActive=now;
    if(session.seconds===60&&!session.counted){session.counted=true;this.game.sessionCounted();}
    const xp=R.XP_PER_SECOND*R.boost(new Date(now));
    this.game.addXp(xp);session.xp+=xp;
    const key=this.connected?this.bridge.project:'', info=this.data.projectInfo[key]||{};
    this.game.activeSecond(session.seconds,key);
    Economy.check(this,true);
    const rate=info.rate==null?this.data.settings.hourlyRate:info.rate;
    const money=rate/3600;session.money+=money; const cur=this.data.settings.currency; session.income ||= {}; session.income[cur]=(session.income[cur]||0)+money;
    if(key){const p=this.data.projectInfo[key] ||= {name:this.bridge.name,notes:'',money:0};p.money=(p.money||0)+money; p.income ||= {}; p.income[cur]=(p.income[cur]||0)+money; p.lastActive=now;}
    if(before<R.rankIndex(this.data.xp)) this.event('Nuevo rango',R.rankOf(this.data.xp).name,'rank');
    const P=this.game.P, goal=this.data.settings.dailyMinutes*60;
    if(goal>0 && P.DaySec>=goal && P.DayGoalHit!==P.Day){P.DayGoalHit=P.Day;this.event('Meta diaria cumplida',`${this.data.settings.dailyMinutes} minutos de edición`,'reward');}
  }
  endSession(){if(this.data.session){if(this.data.session.seconds>0)this.data.sessions.unshift(this.data.session);this.data.sessions=this.data.sessions.slice(0,1000);this.data.session=null;}this.carry=0;}
  packet(p){
    if(!p || typeof p.instance!=='string'||p.instance.length>100||!Number.isSafeInteger(p.seq)||p.seq<0||!Array.isArray(p.events)||p.events.length>100)throw Error('Paquete inválido');
    const prev=this.seenPackets.get(p.instance); if(prev!=null&&p.seq<=prev)return false;
    this.seenPackets.set(p.instance,p.seq);if(this.seenPackets.size>20)this.seenPackets.delete(this.seenPackets.keys().next().value);
    const b=p.state||{}, str=(v,n=512)=>typeof v==='string'?v.slice(0,n):'';
    const oldProject=this.bridge.project;
    this.bridge={at:this.now(),project:str(b.project,2048),name:str(b.name),sequence:str(b.sequence),playing:!!b.playing,exporting:!!b.exporting,capabilities:Array.isArray(b.capabilities)?b.capabilities.filter(x=>typeof x==='string').slice(0,30):[],error:str(b.error)};
    if(oldProject!==this.bridge.project)this.projectOpenedAt=this.now();
    if(this.bridge.project)this.data.projectInfo[this.bridge.project] ||= {name:this.bridge.name,notes:'',money:0};
    for(const e of p.events){
      if(!e||typeof e.kind!=='string')continue;
      // Render completion can arrive in the background; editing bonuses require foreground.
      if(this.paused||(e.kind!=='render'&&!this.focus.premiere))continue;
      this.action(e);
    }
    return true;
  }
  action(a){
    const g=this.game;
    if(a.kind==='trim')g.award('trims',clamp(a.n||1,1,30),30,30,0.1);
    if(a.kind==='fx')g.award('fx',clamp(a.n||1,1,10),10,20,1);
    if(a.kind==='save'&&g.limit('saves',1,4)){g.count('saves',1);g.bonus(0.25);const k='psave:'+this.bridge.project;g.P.Stats[k]=(g.P.Stats[k]||0)+1;g.max('maxpsaves',g.P.Stats[k]);}
    if(a.kind==='cancel'&&g.limit('cancels',1,3))g.count('cancels',1);
    if(a.kind==='render'&&this.now()-this.lastRender>10000){this.lastRender=this.now();if(g.limit('renders',1,2)){g.count('renders',1);g.bonus(15);g.P.LongestRender=Math.max(g.P.LongestRender,clamp(a.ms,0,86400000)/1000);if(this.projectOpenedAt&&this.now()-this.projectOpenedAt<600000)g.max('speedrun',1);if((g.P.Projects[this.bridge.project]||0)>=18000)g.max('finisher',1);this.event('Exportación terminada',this.bridge.name||'Premiere','render',15);}}
    if(a.kind==='snapshot'){
      const current=a.snap;
      if(!current||!['clips','aclips','tracks','vtracks','minutes'].every(k=>Number.isFinite(current[k])&&current[k]>=0&&current[k]<1e7))return;
      const key=this.bridge.project+'|'+this.bridge.sequence, old=this.snapshotKey===key?this.lastSnapshot:null;
      if(old){g.award('edits',current.clips+current.aclips-old.clips-old.aclips,20,60,0.5);g.award('audioedits',current.aclips-old.aclips,20,60,0);g.award('tracks',current.tracks-old.tracks,4,6,0.25);}
      g.max('vtracks',current.vtracks);g.max('projmin',Math.floor(current.minutes));this.snapshotKey=key;this.lastSnapshot=current;
    }
  }
  get core(){return {game:this.game,totalXp:this.data.xp,totalSec:this.game.P.ActiveSec,account:{name:''},server:{},tokens:{owned:this.data.owned,balance:this.balance}};}
  get balance(){return Math.max(0,Math.floor(this.data.xp/10)+(this.data.bonusTokens||0)-this.data.spent);}
  owned(item){return Shop.owned(this.core,item);}
  buy(key){const item=Shop.ITEMS.find(i=>i.kind+':'+i.id===key);if(!item||item.creator||item.chest||item.unlock)throw Error('Objeto no disponible para compra');if(this.owned(item))return;if(this.balance<item.price)throw Error('Todavía no tienes suficientes fichas');this.data.spent+=item.price;this.data.owned.push(key);this.game.count('purchases',1);this.event('Objeto desbloqueado',T(item.fr,item.en),'shop');}
  equip(key){
    if(typeof key==='string'&&key.startsWith('title:')){Titles.equip(this,key.slice(6));return;}
    if(key==='banner:'){this.game.P.Banner='';this.data.bannerGif='';return;}
    if(key==='default'){this.game.P.Banner='';this.game.P.NameFx='';this.game.P.Deco='';this.game.P.EarnedTitle='';this.data.bannerGif='';return;}
    const item=Shop.ITEMS.find(i=>i.kind+':'+i.id===key);
    if(!item||!this.owned(item))throw Error('Primero desbloquea este objeto');
    const field={banner:'Banner',namefx:'NameFx',deco:'Deco'}[item.kind];if(field)this.game.P[field]=item.id;if(item.kind==='banner')this.data.bannerGif='';
  }
  chest(){
    const week=this.game.P.Week;if(this.data.chests.includes(week))throw Error('Ya abriste el cofre de esta semana');
    if(this.game.wstat('focus')<30)throw Error('Edita 30 minutos esta semana para abrirlo');
    const roll=crypto.randomInt(100),rarity=roll<60?'Madera':roll<85?'Hierro':roll<97?'Épico':'Legendario';
    const tokens=roll<60?25:roll<85?60:roll<97?150:300;
    this.data.chests.push(week);this.data.bonusTokens+=tokens;this.game.count('chests',1);
    let item=null;if(roll>=85){const eligible=Shop.ITEMS.filter(i=>!i.creator&&!this.owned(i)&&(!i.chest||i.chest===(roll>=97?'legendary':'epic')));if(eligible.length){item=eligible[crypto.randomInt(eligible.length)];const key=item.kind+':'+item.id;this.game.P.ChestItems.push(key);this.data.owned.push(key);}}
    this.event('Cofre '+rarity,`Ganaste ${tokens} fichas${item?' y '+T(item.fr,item.en):''}`,'chest');return {rarity,tokens};
  }
  settings(values){
    const s=this.data.settings;
    for(const key of ['tray','startup','notifications','sound'])if(typeof values[key]==='boolean')s[key]=values[key];
    for(const [k,min,max] of [['nameSpeed',0.25,4],['idleSeconds',5,600],['dailyMinutes',0,1440],['weeklyHours',0,168],['hourlyRate',0,100000]])if(k in values)s[k]=clamp(values[k],min,max);
    if(['MXN','USD','EUR','GBP','CAD','BRL','COP','ARS','CLP','PEN','JPY'].includes(values.currency))s.currency=values.currency;
    if(['dark','light'].includes(values.theme))s.theme=values.theme;
    this.game.P.HoursGoal=s.weeklyHours;
    if(typeof values.name==='string'&&values.name.trim())this.data.name=values.name.trim().slice(0,40);
    if(typeof values.title==='string')this.game.P.Title=values.title.slice(0,80);
  }
  serialize(){this.data.profile=this.game.P;this.data.xpFraction=this.game.xpFrac;return this.data;}
  view(){
    const P=this.game.P, rank=R.rankOf(this.data.xp), next=R.nextRank(this.data.xp), week=this.game.thisWeek, daily=this.game.daily;
    return {releases:require('./lib/releases').view(this.data),version:require('./package.json').version,name:this.data.name,title:P.Title,titles:Titles.list(this),id:this.data.id,created:this.data.created,xp:this.data.xp,rank,ranks:R.RANKS.map(r=>({...r})),nextRank:next,level:R.levelOf(this.data.xp),seconds:P.ActiveSec,daySeconds:P.Day===dayKey(new Date(this.now()))?P.DaySec:0,weekSeconds:this.game.wstat('focus')*60,streak:this.game.currentStreak,bestStreak:P.BestStreak,active:this.active,paused:this.paused,reason:this.reason,focus:this.focus.premiere,idleMs:Number.isFinite(this.focus.idleMs)?this.focus.idleMs:null,connected:this.connected,bridge:this.bridge,settings:this.data.settings,session:this.data.session,sessions:this.data.sessions.map(s=>({...s,money:s.income?.[this.data.settings.currency]||0})),events:this.data.events,stats:P.Stats,dayLog:P.DayLog,dayXp:P.DayXp,projects:Object.entries(P.Projects).map(([key,seconds])=>({key,seconds,...this.data.projectInfo[key],money:this.data.projectInfo[key]?.income?.[this.data.settings.currency]||0})).sort((a,b)=>b.seconds-a.seconds),projectInfo:this.data.projectInfo,week:week.map(q=>({...q,title:T(q.fr,q.en),description:T(q.dFr,q.dEn),progress:this.game.progress(q),done:P.WeekCleared.includes(q.id)})),daily:{...daily,title:T(daily.fr,daily.en),progress:this.game.dayStat(daily.stat),done:this.game.dailyDone},achievements:this.catalog.map(a=>({id:a.id,name:T(a.fr,a.en),description:T(a.dFr,a.dEn),goal:a.goal,reward:a.reward,progress:Math.max(0,Math.min(a.goal,this.data.socialProgress?.[a.id]??a.v(P)??0)),unlocked:!!P.Unlocked[a.id],pending:SOCIAL.has(a.id)&&!['rival_beat','networker','popular','chatterbox'].includes(a.id)?'Pr?ximamente en Social':UNOBSERVABLE.has(a.id)?'Sin detección fiable en el puente actual':'',category:a.category||achCat(a),tier:achTier(a)})),shop:Shop.ITEMS.filter(i=>!i.creator).map(i=>({id:i.id,key:i.kind+':'+i.id,name:T(i.fr,i.en),kind:i.kind,price:i.price,owned:this.owned(i),condition:i.chest?'Exclusivo de cofres':i.unlock?T(i.condFr,i.condEn):'',equipped:P[{banner:'Banner',namefx:'NameFx',deco:'Deco'}[i.kind]]===i.id})),balance:this.balance,cosmetics:{banner:P.Banner,namefx:P.NameFx,deco:P.Deco,badges:P.Badges||[]},chestReady:this.game.wstat('focus')>=30&&!this.data.chests.includes(P.Week),chestOpened:this.data.chests.includes(P.Week),posts:this.data.posts,doubleXp:R.boost(new Date(this.now()))===2};
  }
}
module.exports={Engine,T,SOCIAL,UNOBSERVABLE};
