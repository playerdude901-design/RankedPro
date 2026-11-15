'use strict';
const R=require('./rules');
const milestones=[[900,50],[1800,100],[3600,150],[7200,200]];
function init(e){
 const p=e.game.P;
 if(!e.data.economy){e.data.economy={day:p.Day,steps:milestones.filter(([s])=>p.DaySec>=s).map(([s])=>s),daily:p.DailyDone,week:p.Week,weekly:[...p.WeekCleared],all:p.WeekCleared.length>=5,achievements:Object.keys(p.Unlocked),rank:R.rankIndex(e.data.xp),dailyTokens:p.DaySec>=1800};}
}
function award(e,n,text){e.data.bonusTokens+=n;e.event('Fichas obtenidas',text+' · +'+n+' fichas','reward');}
function check(e,active=false){
 const p=e.game.P,s=e.data.economy;
 if(s.day!==p.Day){s.day=p.Day;s.steps=[];s.dailyTokens=false;}
 if(active){for(const [seconds,xp]of milestones)if(p.DaySec>=seconds&&!s.steps.includes(seconds)){s.steps.push(seconds);e.game.addXp(xp);if(e.data.session)e.data.session.xp+=xp;e.event('Bono de edición',seconds/60+' minutos activos · +'+xp+' XP','reward',xp);}
 if(p.DaySec>=1800&&!s.dailyTokens){s.dailyTokens=true;award(e,15,'30 minutos activos del día');}}
 if(p.DailyDone&&s.daily!==p.DailyDone){s.daily=p.DailyDone;award(e,10,'Reto diario completado');}
 if(s.week!==p.Week){s.week=p.Week;s.weekly=[];s.all=false;}
 for(const id of p.WeekCleared)if(!s.weekly.includes(id)){s.weekly.push(id);award(e,25,'Reto semanal completado');}
 if(p.WeekCleared.length>=5&&!s.all){s.all=true;award(e,50,'Cinco retos semanales completados');}
 for(const a of e.catalog)if(p.Unlocked[a.id]&&!s.achievements.includes(a.id)){s.achievements.push(a.id);award(e,a.reward<=150?5:a.reward<=400?10:a.reward<=1000?20:a.reward<=1500?30:a.reward<=2999?40:50,'Logro: '+a.en);}
 const rank=R.rankIndex(e.data.xp);for(let i=s.rank+1;i<=rank;i++)award(e,Math.min(200,25*i),'Nuevo rango: '+R.RANKS[i].name);s.rank=Math.max(s.rank,rank);
}
module.exports={init,check};
