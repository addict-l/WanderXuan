"""Publish only the signed APK, without credentials or source artifacts."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

source = Path('/tmp/CoupleRoom-1.0.0-release.apk')
expected = sys.argv[1]
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
folder = Path('/opt/couple-room/downloads')
folder.mkdir(mode=0o755, exist_ok=True)
target = folder / 'CoupleRoom-1.0.0.apk'
shutil.copyfile(source, target)
target.chmod(0o644)
snippet = Path('/etc/nginx/snippets/couple-room.conf')
before = snippet.read_text()
if '/couple-room/downloads/' in before:
    raise SystemExit('Download route already exists')
snippet.write_text(before + '''
location = /couple-room/downloads/CoupleRoom-1.0.0.apk {
    alias /opt/couple-room/downloads/CoupleRoom-1.0.0.apk;
    default_type application/vnd.android.package-archive;
    add_header Content-Disposition 'attachment; filename="CoupleRoom-1.0.0.apk"';
    add_header X-Content-Type-Options nosniff;
}
''')
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    snippet.write_text(before)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print(json.dumps({'apk_bytes': target.stat().st_size, 'sha256': expected, 'download_ready': True}))
