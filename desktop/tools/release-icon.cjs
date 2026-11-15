const path = require('node:path');
const {execFileSync} = require('node:child_process');

module.exports = async function applyWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') return;
  const project = path.resolve(__dirname, '..');
  const executable = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  execFileSync('python', [path.join(__dirname, 'embed-icon.py'), executable, path.join(project, 'app/assets/icon.ico')]);
};
