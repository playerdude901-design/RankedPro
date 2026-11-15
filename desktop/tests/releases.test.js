const test=require('node:test'),assert=require('node:assert/strict');
const releases=require('../app/lib/releases'),{Engine}=require('../app/engine'),{validate}=require('../app/store');
test('Release acknowledgement persists and each new version is unread',()=>{
 const e=new Engine();assert.ok(e.view().releases.unread);
 const version=e.view().version;assert.ok(e.view().releases.notes.some(p=>p.version===version));
 assert.throws(()=>releases.acknowledge(e.data,'unknown'));
 releases.acknowledge(e.data,version);
 const restored=new Engine(validate(JSON.parse(JSON.stringify(e.serialize()))));assert.equal(restored.view().releases.unread,false);
 restored.data.releaseNotesSeen='1.1.0';assert.equal(restored.view().releases.unread,true);
});
