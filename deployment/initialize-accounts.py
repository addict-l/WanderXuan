"""Rotate migration passwords before exposing this new service. JSON on stdin."""
import json
import sys
import urllib.request

BASE = 'http://127.0.0.1:8090'

def request(path, body, token=None, method='POST'):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)

credentials = json.load(sys.stdin)
assert {a['email'] for a in credentials['accounts']} == {'xiaoxuan@example.com', 'wanru@example.com'}
for account in credentials['accounts']:
    auth = request('/api/collections/users/auth-with-password', {'identity': account['email'], 'password': '123456'})
    assert auth['record']['who'] == account['who']
    request('/api/collections/users/records/' + auth['record']['id'], {
        'oldPassword': '123456',
        'password': account['password'],
        'passwordConfirm': account['password'],
    }, auth['token'], 'PATCH')
    check = request('/api/collections/users/auth-with-password', {'identity': account['email'], 'password': account['password']})
    assert check['record']['who'] == account['who']
print(json.dumps({'passwords_initialized': 2, 'new_credentials_verified': True}))
