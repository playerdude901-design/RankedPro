const test=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../app/engine'),E=require('../app/lib/economy');
test('Daily XP milestones accumulate across sessions and reload without duplication',()=>{
 let t=new Date(2026,10,16,12).getTime();let e=new Engine({},()=>t);
 const run=n=>{for(let i=0;i<n;i++){t+=1000;e.second();}};
 run(1800);assert.ok(Math.abs(e.data.xp-450)<=1);assert.equal(e.data.bonusTokens,15);
 e.endSession();e=new Engine(JSON.parse(JSON.stringify(e.serialize())),()=>t);run(1800);
 assert.ok(Math.abs(e.data.xp-900)<=1);assert.equal(e.data.bonusTokens,15);
 const xp=e.data.xp;E.check(e,true);assert.equal(e.data.xp,xp);
 t=new Date(2026,10,17,12).getTime();run(1800);assert.equal(e.data.bonusTokens,30);
});
test('Double XP applies only to elapsed time; milestones stay fixed',()=>{
 const R=require('../app/lib/rules');let t=new Date(2026,10,14,12).getTime();while(!R.isDoubleWeekend(new Date(t)))t+=86400000;
 const e=new Engine({},()=>t);for(let i=0;i<3600;i++){t+=1000;e.second();}
 assert.ok(Math.abs(e.data.xp-1500)<=1);assert.equal(e.data.bonusTokens,15);
});
test('Quest, achievement and rank tokens are credited once and old rewards are not replayed',()=>{
 const e=new Engine();e.game.P.Unlocked.first_steps=1;e.game.P.WeekCleared=['a','b','c','d','e'];e.game.P.DailyDone=e.game.today();e.data.xp=2500;E.check(e);
 assert.equal(e.data.bonusTokens,5+125+50+10+25);
 const reloaded=new Engine(JSON.parse(JSON.stringify(e.serialize())));E.check(reloaded);assert.equal(reloaded.data.bonusTokens,e.data.bonusTokens);
 const old=e.serialize();delete old.economy;const migrated=new Engine(old);const before=migrated.data.bonusTokens;E.check(migrated);assert.equal(migrated.data.bonusTokens,before);
});
