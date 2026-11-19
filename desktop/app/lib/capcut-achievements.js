 'use strict';
const milestones=[
 ['capcut_first','Primer corte en CapCut','Acumula 15 minutos activos en CapCut.',900,50],
 ['capcut_hour','Ritmo vertical','Acumula 1 hora activa en CapCut.',3600,100],
 ['capcut_five','Flujo creativo','Acumula 5 horas activas en CapCut.',18000,250],
 ['capcut_twenty','Especialista CapCut','Acumula 20 horas activas en CapCut.',72000,600],
 ['capcut_hundred','Maestro de CapCut','Acumula 100 horas activas en CapCut.',360000,1500]
];
module.exports=milestones.map(([id,fr,dFr,goal,reward])=>({id,glyph:0xE914,en:fr,fr,dEn:dFr,dFr,v:p=>p.CapCutSec||0,goal,reward,category:'capcut'}));
