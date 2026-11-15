const test=require('node:test'),assert=require('node:assert/strict');
const {SaveTracker}=require('../app/save-tracker');
test('project save observation establishes baseline and ignores inactive apps',async()=>{
 let mtime=10,count=0,calls=0;const t=new SaveTracker(async()=>{calls++;return {mtimeMs:mtime};});
 const e={connected:true,focus:{premiere:true},paused:false,bridge:{project:'D:\\test.prproj'},action:()=>count++};
 await t.poll(e);assert.equal(count,0);mtime=20;await t.poll(e);assert.equal(count,1);await t.poll(e);assert.equal(count,1);
 e.focus.premiere=false;mtime=30;await t.poll(e);assert.equal(calls,3);assert.equal(count,1);
 e.focus.premiere=true;e.bridge.project='D:\\other.prproj';await t.poll(e);assert.equal(count,1);
});
