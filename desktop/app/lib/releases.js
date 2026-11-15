'use strict';
const notes=require('../release-notes.json');
const version=require('../package.json').version;
function view(data){return {version,unread:data.releaseNotesSeen!==version,notes};}
function acknowledge(data,value){if(value!==version)throw Error('Versión de novedades inválida');data.releaseNotesSeen=version;}
module.exports={view,acknowledge};
