"""Publish a verified Windows build to the public release feed, using Git Credential Manager."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

root = Path(__file__).resolve().parent.parent
build = root / 'release'
version = json.loads((root / 'app/package.json').read_text())['version']
tag = 'v' + version
api = 'https://api.github.com/repos/playerdude901-design/RankedPro/releases'
installer = build / 'RankedPro-Setup.exe'
assets = [installer, build / (installer.name + '.blockmap'), build / 'latest.yml']
manifest = assets[2].read_text()
assert re.search(r'^version: ' + re.escape(version) + '$', manifest, re.M)
assert all(p.is_file() and p.stat().st_size for p in assets)
with installer.open('rb') as stream:
    digest = hashlib.file_digest(stream, 'sha512').digest()
assert base64.b64encode(digest).decode() in manifest
credentials = subprocess.run(['git','-c','credential.interactive=false','credential','fill'],
    input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True, check=True)
token = dict(line.split('=',1) for line in credentials.stdout.splitlines() if '=' in line)['password']

def request(url, method='GET', data=None, content='application/json', extra=None):
    headers = {'Authorization':'Bearer '+token,'Content-Type':content,'User-Agent':'RankedPro-release'}
    headers.update(extra or {})
    with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=300) as response:
        return json.load(response)

notes=json.loads((root/'app/release-notes.json').read_text(encoding='utf-8'))
patch=next(p for p in notes if p['version']==version)
body='# '+patch['title']+'\n\n'+'\n\n'.join('## '+s['title']+'\n'+'\n'.join('- '+item for item in s['items']) for s in patch['sections'])
target=os.environ.get('RANKED_RELEASE_COMMIT','main')
existing = next((r for r in request(api) if r['tag_name']==tag),None)
if existing and not existing['draft']:
    raise SystemExit('This version is already public. Increment the version for the next release.')
release = existing or request(api,'POST',json.dumps(dict(tag_name=tag,target_commitish=target,name='Ranked Pro '+version,draft=True,body=body)).encode())
upload = release['upload_url'].split('{')[0]
for file in assets:
    with file.open('rb') as stream:
        sha='sha256:'+hashlib.file_digest(stream,'sha256').hexdigest()
    previous=next((a for a in release['assets'] if a['name']==file.name),None)
    if previous and previous.get('digest')==sha:
        continue
    if previous:
        raise SystemExit('Conflicting file in draft: '+file.name)
    with file.open('rb') as stream:
        uploaded=request(upload+'?name='+file.name,'POST',stream,'application/octet-stream',{'Content-Length':str(file.stat().st_size)})
    assert uploaded['size']==file.stat().st_size and uploaded.get('digest')==sha
    print('Verified upload:',file.name,flush=True)
print(request(release['url'],'PATCH',b'{"draft":false,"make_latest":"true"}')['html_url'])
