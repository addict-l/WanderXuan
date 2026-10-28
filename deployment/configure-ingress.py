"""Add only the isolated CoupleRoom API route to the existing HTTPS host."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import urllib.request

site = Path('/etc/nginx/sites-available/shinian-api-idn')
snippet = Path('/etc/nginx/snippets/couple-room.conf')
backup = Path('/opt/couple-room/backups/ingress-before-20261029')
backup.mkdir(parents=True, mode=0o700)
old = site.read_bytes()
if b'couple-room' in old or snippet.exists():
    raise SystemExit('Refusing to overwrite existing ingress')
shutil.copy2(site, backup / site.name)
shutil.copy2('/etc/nginx/nginx.conf', backup / 'nginx.conf')
before = subprocess.check_output(['docker', 'inspect', '--format', '{{.Id}} {{.Image}}', 'backend-api-1'], text=True).strip()
(backup / 'existing-backend-container.txt').write_text(before + '\n')
snippet.write_text('''# CoupleRoom API only. Data and upstream are independent of the existing API.
location ^~ /couple-room/api/ {
    # File tokens are query parameters; keep them out of access logs.
    access_log off;
    proxy_pass http://127.0.0.1:8090/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 180s;
    client_max_body_size 16M;
}
location = /couple-room { return 404; }
location ^~ /couple-room/ { return 404; }
''')
text = old.decode()
needle = '    client_max_body_size 50M;'
assert text.count(needle) == 1
site.write_text(text.replace(needle, needle + '\n    include /etc/nginx/snippets/couple-room.conf;'))
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    site.write_bytes(old)
    snippet.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
after = subprocess.check_output(['docker', 'inspect', '--format', '{{.Id}} {{.Image}}', 'backend-api-1'], text=True).strip()
assert before == after
with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=15) as response:
    existing_health = json.load(response)
receipt = {
    'existing_backend_container_unchanged': before == after,
    'existing_backend_health': existing_health,
    'original_nginx_sha256': hashlib.sha256(old).hexdigest(),
    'route': 'https://api.xn--zbs33ddmy9oeqa.club/couple-room',
    'upstream': '127.0.0.1:8090',
}
Path('/opt/couple-room/deployment-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
