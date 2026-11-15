'use strict';
const fs=require('node:fs/promises');
// Observe only the current project file. Never enumerate folders or read project contents.
class SaveTracker {
 constructor(stat=fs.stat){this.stat=stat;this.key='';this.mtime=null;this.busy=false;}
 async poll(engine){
  if(this.busy||!engine.connected||!engine.focus.premiere||engine.paused)return;
  const key=engine.bridge.project;
  const check=key.startsWith('\\\\?\\')?key.slice(4):key;
  if(!/^[A-Za-z]:[\\/].+\.prproj$/i.test(check))return;
  if(this.key!==key){this.key=key;this.mtime=null;}
  this.busy=true;
  try{const info=await this.stat(key);if(engine.bridge.project!==key)return;
   const changed=this.mtime!==null&&info.mtimeMs>this.mtime;this.mtime=info.mtimeMs;
   if(changed&&!engine.paused&&engine.focus.premiere)engine.action({kind:'save'});
  }catch{}finally{this.busy=false;}
 }
}
module.exports={SaveTracker};
