"""Install the new isolated CoupleRoom service. Run as root on the target host."""
from pathlib import Path
import hashlib
import json
import os
import pwd
import shutil
import subprocess
import tarfile
import time
import urllib.request
import zipfile

ROOT = Path('/opt/couple-room')
RELEASE = ROOT / 'releases' / '20261029-1'
UPLOAD = Path('/tmp/couple-room-upload-20261029.tar.gz')

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()

if ROOT.exists():
    raise SystemExit('Refusing to overwrite an existing CoupleRoom installation')
if os.geteuid() != 0:
    raise SystemExit('Root required')
try:
    pwd.getpwnam('couple-room')
except KeyError:
    run('useradd', '--system', '--user-group', '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', 'couple-room')

RELEASE.mkdir(parents=True)
with tarfile.open(UPLOAD) as archive:
    for item in archive.getmembers():
        if not (RELEASE / item.name).resolve().is_relative_to(RELEASE.resolve()):
            raise SystemExit('Unsafe archive')
    archive.extractall(RELEASE, filter='data')
binary_zip = RELEASE / 'server/pocketbase/pocketbase_0.40.5_linux_amd64.zip'
expected = '1dbea1b01eb3dfe64953513859d01e759c96650c4e3264fa4eecd54b769382e4'
assert hashlib.sha256(binary_zip.read_bytes()).hexdigest() == expected
with zipfile.ZipFile(binary_zip) as archive:
    (RELEASE / 'pocketbase').write_bytes(archive.read('pocketbase'))
(RELEASE / 'pocketbase').chmod(0o755)
print(run(str(RELEASE / 'pocketbase'), '--version'))
help_text = run(str(RELEASE / 'pocketbase'), 'serve', '--help')
assert '--http' in help_text and '--origins' in help_text
data = ROOT / 'pb_data'
data.mkdir(mode=0o700)
shutil.chown(data, user='couple-room', group='couple-room')
(ROOT / 'current').symlink_to(RELEASE)
unit = '''[Unit]
Description=CoupleRoom PocketBase
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=couple-room
Group=couple-room
WorkingDirectory=/opt/couple-room/current
ExecStart=/opt/couple-room/current/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/couple-room/pb_data --migrationsDir=/opt/couple-room/current/server/pb_migrations --origins=https://appassets.androidplatform.net,https://api.xn--zbs33ddmy9oeqa.club
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/couple-room/pb_data

[Install]
WantedBy=multi-user.target
'''
Path('/etc/systemd/system/couple-room.service').write_text(unit)
run('systemctl', 'daemon-reload')
run('systemctl', 'enable', '--now', 'couple-room.service')
for _ in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8090/api/health', timeout=2) as response:
            health = json.load(response)
        print(json.dumps({'service': run('systemctl', 'is-active', 'couple-room'), 'health': health}))
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit('Health check failed; inspect journalctl -u couple-room')
