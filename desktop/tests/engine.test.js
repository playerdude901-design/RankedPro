const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Engine}=require('../app/engine'),{Store,validate}=require('../app/store');
function setup(){let t=new Date(2026,10,12,12).getTime();const e=new Engine({},()=>t);return {e,advance(n,focus=true,idle=0){for(let i=0;i<n;i++){t+=1000;e.sample({premiere:focus,pid:123,idleMs:idle});e.tick();}},jump(n){t+=n;},now:()=>t};}
test('Only counts fresh foreground activity; pause and idle cannot earn',()=>{const {e,advance}=setup();advance(11);assert.equal(e.game.P.ActiveSec,10);const xp=e.data.xp;advance(20,false);assert.equal(e.game.P.ActiveSec,10);advance(20,true,65000);assert.equal(e.game.P.ActiveSec,10);e.paused=true;advance(20);assert.equal(e.game.P.ActiveSec,10);assert.equal(e.data.xp,xp);e.paused=false;advance(11);assert.equal(e.game.P.ActiveSec,20);});
test('No time is credited over suspension or a stale native sampler',()=>{const {e,advance,jump}=setup();advance(11);jump(3600000);e.tick();assert.equal(e.game.P.ActiveSec,10);advance(3);assert.equal(e.game.P.ActiveSec,12);jump(3000);e.tick();assert.equal(e.game.P.ActiveSec,12);assert.match(e.reason,/desconectado/);});
test('Session ends after 15 minutes and survives serialization without offline credit',()=>{const {e,advance,jump,now}=setup();advance(62);assert.equal(e.game.P.Sessions,1);const data=JSON.parse(JSON.stringify(e.serialize()));jump(20000);const restored=new Engine(data,now);assert.equal(restored.game.P.ActiveSec,61);assert.equal(restored.data.session.seconds,61);advance(901,false);assert.equal(e.data.session,null);assert.equal(e.data.sessions.length,1);});
test('Packets are idempotent, first snapshot is a baseline, focus gates action bonuses',()=>{const {e,advance}=setup();advance(2);const state={project:'C:/test.prproj',name:'Test',sequence:'Sequence'};const packet=(seq,events)=>({instance:'test',seq,state,events});e.packet(packet(1,[{kind:'snapshot',snap:{clips:10,aclips:2,tracks:3,vtracks:2,minutes:5}}]));assert.equal(e.game.stat('edits'),0);e.packet(packet(2,[{kind:'snapshot',snap:{clips:11,aclips:3,tracks:4,vtracks:3,minutes:5}}]));assert.equal(e.game.stat('edits'),2);assert.equal(e.packet(packet(2,[{kind:'fx'}])),false);assert.equal(e.game.stat('fx'),0);advance(2,false);e.packet(packet(3,[{kind:'fx'}]));assert.equal(e.game.stat('fx'),0);assert.throws(()=>e.packet({}),/inválido/);});
test('Fresh bridge project attribution, currency isolation, pause exports',()=>{const {e,advance}=setup();advance(2);e.settings({hourlyRate:3600,currency:'MXN'});e.packet({instance:'test',seq:1,state:{project:'p',name:'Film'},events:[]});advance(3);assert.equal(e.game.P.Projects.p,3);assert.equal(e.data.projectInfo.p.income.MXN,3);e.settings({currency:'USD'});advance(2);assert.equal(e.view().projects[0].money,2);e.settings({currency:'MXN'});assert.equal(e.view().projects[0].money,3);e.paused=true;e.packet({instance:'test',seq:2,state:{project:'p'},events:[{kind:'render',ms:1000}]});assert.equal(e.game.stat('renders'),0);});
test('Chest requires editing, cannot claim twice, local inventory cannot overspend',()=>{const {e}=setup();assert.throws(()=>e.chest(),/30 minutos/);e.game.P.WeekStats.focus=30;const prize=e.chest();assert.ok(prize.tokens>0);assert.throws(()=>e.chest(),/Ya abriste/);e.data.xp=100000;const item=e.view().shop.find(i=>i.price>0&&!i.condition);const before=e.balance;e.buy(item.key);assert.equal(e.balance,before-item.price);e.buy(item.key);assert.equal(e.balance,before-item.price);e.equip(item.key);assert.ok(e.view().shop.find(i=>i.key===item.key).equipped);assert.throws(()=>e.buy('invalid'));});
test('Settings bounds and goal consistency',()=>{const {e}=setup();e.settings({idleSeconds:-100,weeklyHours:10000,hourlyRate:NaN,currency:'INVALID'});assert.equal(e.data.settings.idleSeconds,5);assert.equal(e.data.settings.weeklyHours,168);assert.equal(e.game.P.HoursGoal,168);assert.equal(e.data.settings.currency,'MXN');});
test('All local quests use observable counters; achievement catalog preserved',()=>{const {e}=setup();const s=e.view();assert.equal(s.achievements.length,106);assert.equal(s.week.length,5);assert.equal(new Set(s.week.map(q=>q.stat)).size,5);assert.ok(s.achievements.some(a=>a.pending));assert.ok(s.achievements.some(a=>a.category==='time'));});
test('Store atomic roundtrip, recovery backup, refuses invalid import',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ranked-pro-test-'));try{const store=new Store(dir);const {e}=setup();store.save(e.serialize());e.data.name='Changed';store.save(e.serialize());assert.equal(store.load().name,'Changed');fs.writeFileSync(store.file,'bad');assert.equal(store.load().name,'Mi estudio');assert.match(store.warning,/recuperó/);assert.throws(()=>validate({schema:7}));const data=JSON.parse(JSON.stringify(e.serialize()));data.xp=-1;assert.throws(()=>validate(data));}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('Ten calendar anniversaries unlock once, including leap-day profiles',()=>{
  const created=Date.UTC(2024,1,29,12);
  let now=created, data={created};
  for(let years=1;years<=10;years++){
    const anniversary=Date.UTC(2024+years,2,0,12);
    const id='account_age_'+(years*365);
    now=anniversary-5000;
    const engine=new Engine(data,()=>now);
    engine.tick();
    assert.ok(!engine.game.P.Unlocked[id]);
    now=anniversary;
    engine.tick();
    assert.ok(engine.game.P.Unlocked[id]);
    const restored=new Engine(engine.serialize(),()=>now);
    restored.tick();
    assert.equal(restored.data.xp,engine.data.xp);
    data=restored.serialize();
  }
});
