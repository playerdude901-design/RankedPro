const test=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../app/engine');
const {validate}=require('../app/store');
test('Rank titles and banners unlock retroactively without spending or altering achievements',()=>{
 const e=new Engine({xp:35000});const before=e.view().achievements;const balance=e.balance;
 assert.ok(e.view().titles.find(t=>t.id==='rank_gold').unlocked);
 assert.ok(!e.view().titles.find(t=>t.id==='rank_diamond').unlocked);
 e.equip('title:rank_gold');e.equip('banner:rank_gold');
 assert.equal(e.balance,balance);assert.deepEqual(e.view().achievements,before);
 const restored=new Engine(validate(JSON.parse(JSON.stringify(e.serialize()))));
 assert.ok(restored.view().titles.find(t=>t.id==='rank_gold').equipped);
 assert.equal(restored.view().cosmetics.banner,'rank_gold');
 restored.equip('title:');restored.equip('banner:');
 assert.ok(!restored.view().titles.some(t=>t.equipped));assert.equal(restored.view().cosmetics.banner,'');
});
test('Locked and unknown titles cannot be equipped and user phrase is retained',()=>{
 const e=new Engine();e.game.P.Title='Mi frase';
 for(const id of ['rank_radiant','og','veteran','missing','collector_10'])assert.throws(()=>e.equip('title:'+id),/desbloquea/);
 e.equip('title:rank_iron');assert.equal(e.game.P.Title,'Mi frase');
 const ids=e.catalog.slice(0,10).map(a=>a.id);ids.forEach(id=>e.game.P.Unlocked[id]=1);
 e.equip('title:collector_10');assert.ok(e.view().titles.find(t=>t.id==='collector_10').equipped);
 e.game.P.Unlocked.account_age_365=1;e.equip('title:og');
 e.equip('default');assert.equal(e.game.P.EarnedTitle,'');assert.equal(e.game.P.Title,'Mi frase');
});
