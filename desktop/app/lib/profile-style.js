 'use strict';
const {RANKS}=require('./rules');
const EFFECTS=[{id:'none',name:'Color sólido',rank:0},{id:'orbit',name:'Pulso',rank:2},{id:'sweep',name:'Destello',rank:3},{id:'prism',name:'Prisma',rank:5},{id:'aurora',name:'Aurora',rank:6},{id:'radiant',name:'Radiante',rank:8}];
const BORDERS=['none','violet','sakura','cyan','gold',...EFFECTS.map(e=>e.id)];
function clean(value){return BORDERS.includes(value)?value:'none';}
function list(engine){return EFFECTS.map(e=>({...e,unlocked:engine.data.xp>=RANKS[e.rank].xp,condition:e.rank?'Alcanza '+RANKS[e.rank].name:'Disponible para todos'}));}
function allowed(engine,id){return !EFFECTS.some(e=>e.id===id&&engine.data.xp<RANKS[e.rank].xp);}
module.exports={BORDERS,clean,list,allowed};
