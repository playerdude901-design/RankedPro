const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Bridge backs off while app absent; does no Premiere polling when not foreground',async()=>{
 let calls=0,projectCalls=0,next,setup;
 const sandbox={require:id=>id==='premierepro'?{Constants:{},EventManager:{},Project:{getActiveProject:async()=>{projectCalls++;return null;}}}:id==='uxp'?{entrypoints:{setup:x=>setup=x}}:{port:49371,token:'test'},Date,Math,console,document:{getElementById:()=>({textContent:''})},setTimeout:fn=>{next=fn;return 1;},clearTimeout:()=>{},fetch:async()=>{calls++;return {ok:true,json:async()=>({scan:false,snapshot:false})};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../bridge/main.js'),'utf8'),sandbox);await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.equal(projectCalls,0);assert.ok(next);assert.ok(setup.panels.bridge);assert.equal(typeof setup.plugin.create,'function');setup.plugin.destroy();
});
