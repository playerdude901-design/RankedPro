'use strict';
const {RANKS}=require('./rules');
const names=['Editor emergente','Editor en ascenso','Editor creativo','Editor profesional','Especialista de montaje','Maestro de edición','Visionario','Leyenda de la edición','Ícono del montaje'];
const TITLES=RANKS.map((rank,index)=>({id:'rank_'+rank.name.toLowerCase(),name:names[index],color:rank.color,condition:'Alcanza '+rank.name,ok:e=>e.data.xp>=rank.xp}));
TITLES.push(
 {id:'collector_10',name:'Talento en desarrollo',color:'#75ce97',condition:'Desbloquea 10 logros',ok:e=>e.catalog.filter(a=>e.game.P.Unlocked[a.id]).length>=10},
 {id:'collector_25',name:'Editor versátil',color:'#76b8ff',condition:'Desbloquea 25 logros',ok:e=>e.catalog.filter(a=>e.game.P.Unlocked[a.id]).length>=25},
 {id:'collector_50',name:'Maestro del estudio',color:'#ff807b',condition:'Desbloquea 50 logros',ok:e=>e.catalog.filter(a=>e.game.P.Unlocked[a.id]).length>=50},
 {id:'veteran',name:'Veterano',color:'#f5ba49',condition:'Completa el logro Veteran (300 sesiones)',ok:e=>!!e.game.P.Unlocked.sessions_100},
 {id:'og',name:'OG',color:'#b98cff',condition:'Completa el logro Primer aniversario',ok:e=>!!e.game.P.Unlocked.account_age_365}
);
function list(engine){return TITLES.map(({ok,...item})=>({...item,unlocked:ok(engine),equipped:engine.game.P.EarnedTitle===item.id&&ok(engine)}));}
function equip(engine,id){if(id!==''&&!TITLES.some(t=>t.id===id&&t.ok(engine)))throw Error('Primero desbloquea este título');engine.game.P.EarnedTitle=id;}
module.exports={list,equip};
