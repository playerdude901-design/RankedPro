'use strict';
const {app,BrowserWindow,Tray,Menu,ipcMain,nativeImage,dialog,Notification,powerMonitor,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {Engine}=require('./engine'),{Store,validate}=require('./store');
const {MediaLibrary,KINDS:MEDIA_ACTIONS}=require('./media');
const {SaveTracker}=require('./save-tracker');
const PORT=49371;
app.setName('Ranked Pro');app.setAppUserModelId('RankedPro.Desktop');
if(process.env.RANKED_PRO_DATA)app.setPath('userData',process.env.RANKED_PRO_DATA);
if(!app.requestSingleInstanceLock()){app.quit();}else{
let social;
let window=null,tray=null,quitting=false,monitor=null,server=null,engine,store,media,timer,saveTimer,releaseTimer,saveError='',bridgeError='',nativeError='',nativeAt=0;
const iconPath=path.join(__dirname,'assets','icon.png');
function save(){try{store.save(engine.serialize());if(social?.account)social.save();saveError='';}catch(e){saveError='No se pudo guardar: '+e.message;}}
function status(){return {...engine.view(),social:social?.view(),avatar:engine.game.P.Avatar,bannerGif:engine.data.bannerGif||'',media:media?.list()||[],saveError,bridgeError,nativeError,storage:app.getPath('userData'),warning:store.warning};}
function publish(){if(window&&!window.isDestroyed()&&window.isVisible()&&!window.isMinimized())window.webContents.send('update',status());}
function menu(){tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir Ranked Pro',click:show},{label:engine.paused?'Reanudar seguimiento':'Pausar seguimiento',click:()=>{engine.paused=!engine.paused;engine.tick();menu();publish();}},{type:'separator'},{label:'Salir de Ranked Pro',click:()=>{quitting=true;app.quit();}}]));}
function hideWindow(){window?.hide();save();clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{if(window&&!window.isDestroyed()&&!window.isVisible()&&!media.recording){window.destroy();window=null;}},20000);}
function show(){clearTimeout(releaseTimer);if(!window||window.isDestroyed())createWindow();window.show();window.focus();publish();}
function createWindow(){
 window=new BrowserWindow({width:1280,height:850,minWidth:960,minHeight:660,title:'Ranked Pro',backgroundColor:'#101117',icon:iconPath,autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
 window.webContents.session.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===window.webContents&&(permission==='media'||permission==='display-capture')&&(!!media.selection||media.recording)));
 media.bind(window);
 window.loadFile(path.join(__dirname,'ui','index.html'));
 window.once('ready-to-show',()=>{if(!process.argv.includes('--tray'))window.show();});
 window.on('close',e=>{if(quitting)return;if(engine.data.settings.tray){e.preventDefault();hideWindow();}else{quitting=true;app.quit();}});
 window.on('show',publish);window.on('restore',publish);
}
function startMonitor(){
 const exe=path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'),'bin','FocusMonitor.exe');
 monitor=spawn(exe,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});let buffer='';
 monitor.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>100000)buffer='';let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{engine.sample(JSON.parse(line));nativeAt=Date.now();nativeError='';}catch{}}});
 monitor.on('error',e=>{nativeError='No se pudo iniciar el detector de Windows: '+e.message;});
 monitor.on('exit',()=>{nativeError='Detector detenido. Reinicia Ranked Pro.';});
}
function installBridge(){
 const dir=path.join(app.getPath('appData'),'Adobe','UXP','Plugins','External','com.rankedpro.bridge_0.1.0');
 fs.mkdirSync(dir,{recursive:true});fs.cpSync(path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'),'bridge'),dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'config.js'),'module.exports = '+JSON.stringify({port:PORT,token})+';\n');
 const reg=path.join(app.getPath('appData'),'Adobe','UXP','PluginsInfo','v1','premierepro.json');fs.mkdirSync(path.dirname(reg),{recursive:true});
 let data={plugins:[]};if(fs.existsSync(reg)){data=JSON.parse(fs.readFileSync(reg,'utf8'));if(!Array.isArray(data.plugins))throw Error('Registro de Adobe no válido');fs.copyFileSync(reg,reg+'.rankedpro-backup-'+Date.now());}
 data.plugins=data.plugins.filter(p=>p.pluginId!=='com.rankedpro.bridge');data.plugins.push({hostMinVersion:'25.6.0',name:'Ranked Pro Bridge',path:'$localPlugins\\External\\com.rankedpro.bridge_0.1.0',pluginId:'com.rankedpro.bridge',status:'enabled',type:'uxp',versionString:'0.1.0'});
 const tmp=reg+'.rankedpro-tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,reg);return dir;
}
let token='';
function startServer(){
 server=http.createServer((req,res)=>{
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   const finish=(code,value)=>{res.writeHead(code);res.end(JSON.stringify(value));};
   if(req.headers.authorization!=='Bearer '+token){finish(403,{error:'Forbidden'});return;}
   if(req.method==='GET'&&req.url==='/health'){finish(200,{ok:true,scan:engine.focus.premiere&&!engine.paused,snapshot:engine.focus.premiere&&engine.focus.idleMs>1500&&!engine.paused});return;}
   if(req.method!=='POST'||req.url!=='/events'){finish(404,{error:'Not found'});return;}
   let body='',size=0;req.on('data',c=>{size+=c.length;if(size>64000){req.destroy();return;}body+=c;});
   req.on('end',()=>{try{engine.packet(JSON.parse(body));finish(200,{ok:true});}catch(e){finish(400,{error:'Invalid packet'});}});
 });server.requestTimeout=5000;server.headersTimeout=5000;server.on('error',e=>{bridgeError='Puente local: '+e.message;publish();});server.listen(PORT,'127.0.0.1');
}
app.on('second-instance',show);app.on('window-all-closed',()=>{if(quitting)app.quit();});
app.whenReady().then(()=>{
 store=new Store(app.getPath('userData'));try{engine=new Engine(store.load());}catch(e){dialog.showErrorBox('Ranked Pro — datos protegidos',e.message);quitting=true;app.quit();return;}
 const tf=path.join(app.getPath('userData'),'bridge-token');token=fs.existsSync(tf)?fs.readFileSync(tf,'utf8').trim():crypto.randomBytes(32).toString('hex');if(!/^[a-f0-9]{64}$/.test(token))token=crypto.randomBytes(32).toString('hex');fs.writeFileSync(tf,token);
 const configPath=path.join(app.getPath('userData'),'social-config.json');
 const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):require('./social-config.json');
 social=new (require('./social').Social)(app.getPath('userData'),require('electron').safeStorage,config);
 let avatarCache={source:null,png:''};
 social.getAppearance=()=>{
  const source=engine.game.P.Avatar||'';
  if(source!==avatarCache.source){
   avatarCache={source,png:''};
   if(source.startsWith('data:image/')){
    const picture=nativeImage.createFromDataURL(source);
    if(!picture.isEmpty())avatarCache.png=picture.resize({width:96,height:96}).toDataURL();
   }
  }
  return {avatar:avatarCache.png,namefx:engine.game.P.NameFx||'',speed:engine.data.settings.nameSpeed||1,
   badges:engine.catalog.filter(a=>engine.game.P.Unlocked[a.id]).map(a=>a.id)};
 };
 social.onSocial=(inbox)=>{
  const P=engine.game.P;
  for(const [id,value,goal] of [['rival_beat',inbox.passedRival?1:0,1],['networker',inbox.following,5],['popular',inbox.followers,10],['chatterbox',inbox.messagesSent,100]]){
   if(value>=goal&&!P.Unlocked[id]){
    const item=engine.catalog.find(a=>a.id===id);
    P.Unlocked[id]=Math.floor(Date.now()/1000);engine.game.addXp(item.reward);
    engine.event('Logro social desbloqueado',require('./engine').T(item.fr,item.en),'achievement',item.reward,id);
   }
  }
  engine.data.socialProgress={rival_beat:inbox.passedRival?1:0,networker:inbox.following,popular:inbox.followers,chatterbox:inbox.messagesSent};
 };
 media=new MediaLibrary(app.getPath('userData'),()=>engine);
 tray=new Tray(nativeImage.createFromPath(iconPath));tray.setToolTip('Ranked Pro · Seguimiento local');tray.on('double-click',show);tray.on('click',show);menu();
 engine.onEvent=e=>{if(window?.isVisible())window.webContents.send('toast',e);if(engine.data.settings.notifications&&['achievement','rank','chest','reward'].includes(e.type)&&Notification.isSupported())new Notification({title:e.title,body:e.text,icon:iconPath,silent:!engine.data.settings.sound}).show();};
 if(process.argv.includes('--install-bridge')){try{installBridge();}catch(e){bridgeError='Instalación del puente: '+e.message;}}
 const installedBuild=fs.existsSync(path.join(process.resourcesPath,'app-update.yml'));
 if(installedBuild){
  const bridgeStamp=path.join(app.getPath('userData'),'installed-bridge-version');
  try{
   if(!fs.existsSync(bridgeStamp)||fs.readFileSync(bridgeStamp,'utf8')!==app.getVersion()){
    installBridge();fs.writeFileSync(bridgeStamp,app.getVersion());
   }
  }catch(e){bridgeError='Instalación del puente: '+e.message;}
  const {autoUpdater}=require('electron-updater');
  autoUpdater.autoDownload=true;
  autoUpdater.on('error',e=>console.warn('Actualización:',e.message));
  autoUpdater.on('update-downloaded',async info=>{
   const {response}=await dialog.showMessageBox({type:'info',title:'Ranked Pro',message:'Versión '+info.version+' lista para instalar.',buttons:['Reiniciar ahora','Al salir'],defaultId:1,cancelId:1});
   if(response===0){quitting=true;save();autoUpdater.quitAndInstall();}
  });
  const check=()=>autoUpdater.checkForUpdates().catch(()=>{});
  setTimeout(check,15000).unref();
  setInterval(check,4*60*60*1000).unref();
 }
 createWindow();startServer();startMonitor();
 powerMonitor.on('suspend',()=>{engine.focus.at=0;engine.wasActive=false;save();});powerMonitor.on('resume',()=>{engine.focus.at=0;engine.wasActive=false;engine.lastTick=Date.now();});powerMonitor.on('lock-screen',()=>{engine.focus.at=0;engine.wasActive=false;});
 const saveTracker=new SaveTracker();let savePoll=0;
 timer=setInterval(()=>{const before=engine.game.P.ActiveSec;engine.tick();if(social.account)social.account.total+=Math.max(0,engine.game.P.ActiveSec-before);if(social.account&&savePoll%60===0&&!social.busy)social.run('sync').catch(()=>{});if(++savePoll%5===0)saveTracker.poll(engine);publish();},1000);saveTimer=setInterval(save,15000);
 ipcMain.handle('snapshot',()=>status());
 ipcMain.handle('action',async(_event,kind,value)=>{try{
   if(['signup','login','logout','sync','resend','follow','message'].includes(kind)){
     const result=await social.run(kind,value);save();return {ok:true,...result,state:status()};
   }
   if(MEDIA_ACTIONS.has(kind)){const result=await media.handle(kind,value,window);save();publish();return {ok:true,...result,state:status()};}
   switch(kind){
    case 'readReleaseNotes':require('./lib/releases').acknowledge(engine.data,value);break;
    case 'pause':engine.paused=!engine.paused;engine.tick();menu();break;
    case 'endSession':engine.endSession();break;
    case 'settings':{
      if(!value||typeof value!=='object')throw Error('Ajustes inválidos');
      const old=engine.data.settings.startup;engine.settings(value);
      if(old!==engine.data.settings.startup)app.setLoginItemSettings({openAtLogin:engine.data.settings.startup,path:process.execPath,args:['--tray']});break;
    }
    case 'buy':engine.buy(String(value));break;
    case 'equip':engine.equip(String(value));break;
    case 'chest':engine.chest();break;
    case 'project':{
      if(!value||typeof value.key!=='string'||!engine.data.projectInfo[value.key])throw Error('Proyecto desconocido');
      const p=engine.data.projectInfo[value.key];if(typeof value.notes==='string')p.notes=value.notes.slice(0,10000);if(value.rate===''||value.rate==null)delete p.rate;else if(Number.isFinite(Number(value.rate)))p.rate=Math.max(0,Math.min(100000,Number(value.rate)));break;
    }
    case 'badge':{const id=String(value);if(!engine.game.P.Unlocked[id])throw Error('Logro bloqueado');let badges=engine.game.P.Badges||[];engine.game.P.Badges=badges.includes(id)?badges.filter(x=>x!==id):[...badges,id];break;}
    case 'post':{const text=String(value||'').trim();if(!text)throw Error('Escribe una nota primero');engine.data.posts.unshift({id:crypto.randomUUID(),at:Date.now(),text:text.slice(0,5000)});engine.data.posts=engine.data.posts.slice(0,500);break;}
    case 'deletePost':engine.data.posts=engine.data.posts.filter(p=>p.id!==value);break;
    case 'installBridge':installBridge();break;
    case 'openData':await shell.openPath(app.getPath('userData'));break;
    case 'hide':hideWindow();break;
    case 'quit':quitting=true;app.quit();return {ok:true};
    case 'export':{const result=await dialog.showSaveDialog(window,{title:'Guardar respaldo de Ranked Pro',defaultPath:'Ranked-Pro-respaldo.json',filters:[{name:'Respaldo JSON',extensions:['json']}]});if(!result.canceled)fs.writeFileSync(result.filePath,JSON.stringify(engine.serialize(),null,2));break;}
    case 'import':{
      const result=await dialog.showOpenDialog(window,{title:'Restaurar respaldo de Ranked Pro',properties:['openFile'],filters:[{name:'Respaldo JSON',extensions:['json']}]});if(result.canceled)break;
      if(fs.statSync(result.filePaths[0]).size>20e6)throw Error('Archivo demasiado grande');const data=validate(JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')));
      const confirm=await dialog.showMessageBox(window,{type:'question',buttons:['Cancelar','Restaurar'],defaultId:0,cancelId:0,message:`Restaurar el perfil de ${data.name}`,detail:'Sustituirá el progreso actual. Se guardará una copia antes de continuar.'});if(confirm.response!==1)break;
      fs.writeFileSync(path.join(app.getPath('userData'),'antes-de-restaurar-'+Date.now()+'.json'),JSON.stringify(engine.serialize(),null,2));const onEvent=engine.onEvent;engine=new Engine(data);engine.onEvent=onEvent;app.setLoginItemSettings({openAtLogin:engine.data.settings.startup,path:process.execPath,args:['--tray']});menu();break;
    }
    case 'csv':{const result=await dialog.showSaveDialog(window,{defaultPath:'Ranked-Pro-proyectos.csv',filters:[{name:'CSV',extensions:['csv']}]});if(!result.canceled){const quote=s=>'"'+String(s).replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';const lines=[['Proyecto','Segundos activos','Ingreso estimado','Moneda'],...engine.view().projects.map(p=>[p.name||p.key,p.seconds,(p.money||0).toFixed(2),engine.data.settings.currency])];fs.writeFileSync(result.filePath,'\ufeff'+lines.map(l=>l.map(quote).join(',')).join('\r\n'));}break;}
    case 'capture':{if(!value||!['x','y','width','height'].every(k=>Number.isInteger(value[k])&&value[k]>=0&&value[k]<5000)||value.width<1||value.height<1)throw Error('Área inválida');const img=await window.webContents.capturePage({x:value.x,y:value.y,width:value.width,height:value.height});const result=await dialog.showSaveDialog(window,{defaultPath:value.name==='recap'?'Ranked-Pro-resumen.png':'Ranked-Pro-tarjeta.png',filters:[{name:'Imagen PNG',extensions:['png']}]});if(!result.canceled)fs.writeFileSync(result.filePath,img.toPNG());break;}
    default:throw Error('Acción no disponible');
   }save();publish();return {ok:true,state:status()};
  }catch(e){return {ok:false,error:e.message};}});
 // Automated smoke test requests run only in an isolated test data directory.
 if(process.argv.includes('--smoke-test')&&process.env.RANKED_PRO_DATA){setTimeout(async()=>{try{
   const title=await window.webContents.executeJavaScript('document.title');
   const pages=await window.webContents.executeJavaScript(`(async()=>{const out=[];for(const b of document.querySelectorAll('#nav button')){b.click();await new Promise(r=>setTimeout(r,80));out.push({page:b.dataset.page,text:document.querySelector('#content').textContent.length,scroll:document.body.scrollWidth<=innerWidth});}document.querySelector('[data-page="overview"]').click();await new Promise(r=>setTimeout(r,200));return out;})()`);
   fs.writeFileSync(path.join(app.getPath('userData'),'dashboard.png'),(await window.webContents.capturePage()).toPNG());
   const ownSource=(await media.sources()).find(s=>s.id===window.getMediaSourceId()||s.name==='Ranked Pro');
   if(!ownSource)throw Error('No self capture source '+window.getMediaSourceId()+' '+JSON.stringify((await media.sources()).map(s=>({id:s.id,name:s.name}))));
   await media.handle('mediaScreenshot',ownSource.id,window);
   const recording=await window.webContents.executeJavaScript(`(async()=>{await startRecording(${JSON.stringify(ownSource.id)});if(!recorder)throw Error('Recorder did not start');await new Promise(r=>setTimeout(r,1500));recorder.stop();await new Promise(r=>setTimeout(r,1500));navigate('journal');return state.media.map(x=>({kind:x.kind,exists:x.exists}));})()`,true);
   if(!recording.some(m=>m.kind==='video'))throw Error('Recorded video missing');
   await window.webContents.executeJavaScript(`navigate('overview')`);await new Promise(r=>setTimeout(r,200));
   window.close();const hidden=!window.isVisible();await new Promise(r=>setTimeout(r,21000));const rendererReleased=!window;show();await new Promise(r=>setTimeout(r,1000));const state=status();
   const portOK=await new Promise(resolve=>http.get({hostname:'127.0.0.1',port:PORT,path:'/health',headers:{Authorization:'Bearer '+token}},r=>resolve(r.statusCode===200)).on('error',()=>resolve(false)));
   const rejectsUnauth=await new Promise(resolve=>http.get({hostname:'127.0.0.1',port:PORT,path:'/health'},r=>resolve(r.statusCode===403)).on('error',()=>resolve(false)));
   fs.writeFileSync(path.join(app.getPath('userData'),'smoke.json'),JSON.stringify({title,pages,recording,rendererReleased,closeToTray:hidden,portOK,rejectsUnauth,native:Date.now()-nativeAt<2000,achievements:state.achievements.length,shop:state.shop.length}));
 }catch(e){fs.writeFileSync(path.join(app.getPath('userData'),'smoke-error.txt'),e.stack);}quitting=true;app.quit();},6000);}
}).catch(e=>{dialog.showErrorBox('Ranked Pro',e.stack||e.message);app.quit();});
app.on('before-quit',()=>{quitting=true;clearInterval(timer);clearInterval(saveTimer);if(engine&&store)save();if(monitor){monitor.stdin.end();monitor.kill();}server?.close();tray?.destroy();});
}
