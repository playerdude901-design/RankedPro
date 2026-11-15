const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ranked',{
 snapshot:()=>ipcRenderer.invoke('snapshot'),
 action:(kind,data)=>ipcRenderer.invoke('action',kind,data),
 onUpdate:callback=>{const fn=(_,value)=>callback(value);ipcRenderer.on('update',fn);return()=>ipcRenderer.removeListener('update',fn);},
 onToast:callback=>{const fn=(_,value)=>callback(value);ipcRenderer.on('toast',fn);return()=>ipcRenderer.removeListener('toast',fn);},
 onStopRecording:callback=>{const fn=()=>callback();ipcRenderer.on('stop-recording',fn);return()=>ipcRenderer.removeListener('stop-recording',fn);}
});
