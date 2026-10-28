"""Prepare an isolated first-person test backend. Run as root; JSON on stdin.

Input contains accounts (email/password/who) and migration_files (name/source).
Credentials are never written on the server or printed. This script refuses
existing installations and never opens or copies production PocketBase data.
"""
from pathlib import Path
import hashlib
import json
import os
import pwd
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path('/opt/couple-room-validation/first-person-20261029')
UNIT = Path('/etc/systemd/system/couple-room-fp-candidate.service')
SITE = Path('/etc/nginx/sites-available/shinian-api-idn')
SNIPPET = Path('/etc/nginx/snippets/couple-room-fp-candidate.conf')
BASE = 'http://127.0.0.1:18020'
PUBLIC_BASE = 'https://api.xn--zbs33ddmy9oeqa.club/couple-room/validation/first-person'


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE).strip()


def api(path, method='GET', body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = token
    request = urllib.request.Request(
        BASE + path, method=method, headers=headers,
        data=None if body is None else json.dumps(body).encode(),
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def health(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.load(response)


assert os.geteuid() == 0, 'Run as root'
assert not ROOT.exists(), 'Candidate directory already exists; inspect without overwriting'
assert not UNIT.exists(), 'Candidate service already exists; inspect without overwriting'
assert not SNIPPET.exists(), 'Candidate ingress already exists; inspect without overwriting'
assert not run('ss', '-H', '-lnt', 'sport = :18020'), 'Candidate port is occupied'
pwd.getpwnam('couple-room')
payload = json.load(sys.stdin)
assert {a['email'] for a in payload['accounts']} == {'xiaoxuan@example.com', 'wanru@example.com'}
assert len(payload['accounts']) == 2
assert all(len(a['password']) >= 20 for a in payload['accounts'])
old_site = SITE.read_bytes()
needle = '    include /etc/nginx/snippets/couple-room.conf;'
assert old_site.decode().count(needle) == 1
production_before = {
    'couple_room': health('http://127.0.0.1:8090/api/health'),
    'shinian': health('http://127.0.0.1:8000/health'),
}

ROOT.mkdir(parents=True, mode=0o750)
shutil.chown(ROOT, user='root', group='couple-room')
backup = ROOT / 'backups'
backup.mkdir(mode=0o700)
(backup / 'shinian-api-idn.before').write_bytes(old_site)
(backup / 'shinian-api-idn.before').chmod(0o600)
binary = ROOT / 'pocketbase'
shutil.copyfile('/opt/couple-room/current/pocketbase', binary)
binary.chmod(0o755)
migrations = ROOT / 'pb_migrations'
migrations.mkdir(mode=0o755)
for migration in payload['migration_files']:
    assert Path(migration['name']).name == migration['name'] and migration['name'].endswith('.js')
    (migrations / migration['name']).write_text(migration['source'])
data = ROOT / 'pb_data'
data.mkdir(mode=0o700)
shutil.chown(data, user='couple-room', group='couple-room')
UNIT.write_text(f'''[Unit]
Description=CoupleRoom isolated first-person validation backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=couple-room
Group=couple-room
WorkingDirectory={ROOT}
ExecStart={binary} serve --http=127.0.0.1:18020 --dir={data} --migrationsDir={migrations}
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={data}

[Install]
WantedBy=multi-user.target
''')
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', '--now', 'couple-room-fp-candidate'], check=True, capture_output=True)
for attempt in range(25):
    try:
        candidate_health = api('/api/health')
        break
    except Exception:
        time.sleep(1)
else:
    raise RuntimeError('Candidate failed to become healthy')

# The only password ever used from a checked-in migration is replaced while
# the new service is localhost-only, before its public route is enabled.
for account in payload['accounts']:
    authenticated = api('/api/collections/users/auth-with-password', 'POST', {
        'identity': account['email'], 'password': '123456',
    })
    assert authenticated['record']['who'] == account['who']
    api('/api/collections/users/records/' + authenticated['record']['id'], 'PATCH', {
        'oldPassword': '123456', 'password': account['password'],
        'passwordConfirm': account['password'],
    }, authenticated['token'])
    confirmed = api('/api/collections/users/auth-with-password', 'POST', {
        'identity': account['email'], 'password': account['password'],
    })
    assert confirmed['record']['who'] == account['who']

SNIPPET.write_text('''# First-person candidate API only; no public admin or data-directory access.
location ^~ /couple-room/validation/first-person/api/ {
    access_log off;
    proxy_pass http://127.0.0.1:18020/api/;
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
''')
SITE.write_text(old_site.decode().replace(needle, needle + '\n    include /etc/nginx/snippets/couple-room-fp-candidate.conf;'))
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    SITE.write_bytes(old_site)
    SNIPPET.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
production_after = {
    'couple_room': health('http://127.0.0.1:8090/api/health'),
    'shinian': health('http://127.0.0.1:8000/health'),
}
assert production_before == production_after
metadata = {
    'base_url': PUBLIC_BASE,
    'service': 'couple-room-fp-candidate',
    'service_active': run('systemctl', 'is-active', 'couple-room-fp-candidate'),
    'service_enabled': run('systemctl', 'is-enabled', 'couple-room-fp-candidate'),
    'directory': str(ROOT), 'data_directory': str(data), 'upstream': '127.0.0.1:18020',
    'binary_version': run(str(binary), '--version'),
    'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
    'migration_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in migrations.glob('*.js')},
    'candidate_health': candidate_health,
    'production_health_unchanged': True,
    'production_health': production_after,
    'production_data_accessed': False,
    'passwords_initialized_before_public_route': 2,
    'nginx_original_sha256': hashlib.sha256(old_site).hexdigest(),
}
(ROOT / 'deployment-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata))
