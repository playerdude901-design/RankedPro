const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Social}=require('../app/social'),{Engine}=require('../app/engine');

test('New currency conversion applies to existing XP and preserves spending and chest tokens',()=>{
 const engine=new Engine({xp:1000,spent:3,bonusTokens:25});
 assert.equal(engine.balance,122);
 assert.equal(new Engine(engine.serialize()).balance,122);
});
test('Rival crossing requires a previous followed snapshot and awards a stable flag on later syncs',async()=>{
 const social=new Social(fs.mkdtempSync(path.join(os.tmpdir(),'rp-social-test-')),{}, {url:'https://example.supabase.co',publishableKey:'public'});
 social.data={session:{user:{id:'me'},access_token:'test',expires_at:Date.now()/1000+3600},accounts:{me:{total:0,device:'device'}}};
 social.save=()=>{};
 let seconds=10;
 social.api=async route=>{
  if(route.endsWith('editor_ranking_v2'))return [{id:'me',seconds,mine:true},{id:'rival',seconds:20,following:true}];
  if(route.endsWith('social_inbox'))return {following:1,followers:0,messagesSent:0,messages:[]};
 };
 await social.run('sync');assert.equal(social.inbox.passedRival,false);
 seconds=21;await social.run('sync');assert.equal(social.inbox.passedRival,true);
 seconds=30;await social.run('sync');assert.equal(social.inbox.passedRival,true);
});
