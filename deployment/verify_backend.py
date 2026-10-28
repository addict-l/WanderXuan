#!/usr/bin/env python3
"""Exercise a deployed Couple Room API with two private credential records.

Credentials JSON (kept outside source/delivery folders):
{"accounts": [{"email": "...", "password": "..."}, {"email": "...", "password": "..."}]}

Creates only uniquely identified verification items/photos and removes them.
Temporarily changes account 0's password, then restores the supplied password.
Uses only the Python standard library. Never prints credentials or tokens.
"""

import argparse
import base64
import json
import queue
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class CheckError(Exception):
    pass


def require(value, message):
    if not value:
        raise CheckError(message)


class API:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def request(self, path, method="GET", body=None, token=None,
                headers=None, expect=200, binary=False):
        request_headers = {"Accept": "application/json", **(headers or {})}
        if token:
            request_headers["Authorization"] = token
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            self.base_url + path, data=body, method=method,
            headers=request_headers,
        )
        try:
            response = urllib.request.urlopen(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        except (urllib.error.URLError, TimeoutError):
            raise CheckError(f"{method} {path.split('?')[0]} connection failed") from None
        with response:
            status, response_headers, payload = response.status, response.headers, response.read()
        expected = (expect,) if isinstance(expect, int) else tuple(expect)
        require(status in expected,
                f"{method} {path.split('?')[0]} status {status}, expected {expected}")
        if binary:
            return payload, response_headers
        if not payload:
            return None
        try:
            return json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise CheckError(f"{method} {path.split('?')[0]} returned invalid JSON") from None

    def auth(self, account, password=None):
        result = self.request("/api/collections/users/auth-with-password", "POST", {
            "identity": account["email"],
            "password": account["password"] if password is None else password,
        })
        require(bool(result.get("token")) and bool(result.get("record", {}).get("id")),
                "Authentication result lacks token or record")
        return result


class SSE:
    def __init__(self, api, token):
        self.api = api
        self.events = queue.Queue()
        self.stop = threading.Event()
        self.connection = None
        self.thread = threading.Thread(target=self.read, daemon=True)
        self.thread.start()
        event = self.wait(lambda event: event["event"] == "PB_CONNECT")
        client_id = event.get("id") or event.get("data", {}).get("clientId")
        require(bool(client_id), "SSE connection lacks client ID")
        api.request("/api/realtime", "POST", {
            "clientId": client_id, "subscriptions": ["items/*"],
        }, token=token, expect=204)

    def read(self):
        try:
            request = urllib.request.Request(
                self.api.base_url + "/api/realtime",
                headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
            )
            self.connection = urllib.request.urlopen(request, timeout=25)
            event = {"event": "message", "id": "", "data_lines": []}
            for raw_line in self.connection:
                if self.stop.is_set():
                    break
                line = raw_line.decode("utf-8").rstrip("\r\n")
                if not line:
                    if event["data_lines"] or event["id"]:
                        data = "\n".join(event.pop("data_lines"))
                        event["data"] = json.loads(data) if data else {}
                        self.events.put(event)
                    event = {"event": "message", "id": "", "data_lines": []}
                elif not line.startswith(":"):
                    field, _, value = line.partition(":")
                    value = value.removeprefix(" ")
                    if field in ("event", "id"):
                        event[field] = value
                    elif field == "data":
                        event["data_lines"].append(value)
        except Exception:
            if not self.stop.is_set():
                self.events.put({"error": "SSE connection interrupted"})

    def wait(self, predicate, timeout=15):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                event = self.events.get(timeout=max(0.01, end - time.monotonic()))
            except queue.Empty:
                break
            require(not event.get("error"), event.get("error", ""))
            if predicate(event):
                return event
        raise CheckError("Expected SSE event was not received within 15 seconds")

    def record_event(self, record_id, action):
        event = self.wait(lambda event: (
            event.get("data", {}).get("action") == action
            and event.get("data", {}).get("record", {}).get("id") == record_id
        ))
        return event["data"]["record"]

    def close(self):
        self.stop.set()
        # Closing a streaming HTTPResponse can block until another read returns.
        # A daemon cleanup thread leaves no live connection after process exit.
        if self.connection:
            threading.Thread(target=self.connection.close, daemon=True).start()


def verify(api, accounts):
    results = []
    cleanup_errors = []
    item_ids, photo_ids, streams = [], [], []
    authentications = []
    changed_password = None

    def passed(name):
        results.append({"check": name, "passed": True})

    failure = None
    try:
        health = api.request("/api/health")
        require(health.get("code") == 200, "Health payload code is not 200")
        passed("health")

        _, cors = api.request("/api/collections/users/auth-with-password", "OPTIONS", headers={
            "Origin": "https://appassets.androidplatform.net",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        }, expect=(200, 204), binary=True)
        require(cors.get("Access-Control-Allow-Origin") in (
            "*", "https://appassets.androidplatform.net"), "Asset-origin CORS denied")
        methods = {part.strip().upper() for part in cors.get("Access-Control-Allow-Methods", "").split(",")}
        allowed_headers = {part.strip().lower() for part in cors.get("Access-Control-Allow-Headers", "").split(",")}
        require("POST" in methods or "*" in methods, "CORS POST preflight denied")
        require("*" in allowed_headers or {"content-type", "authorization"} <= allowed_headers,
                "CORS required request headers denied")
        passed("android_asset_origin_cors")

        for index, account in enumerate(accounts):
            auth = api.auth(account)
            require(auth["record"].get("who") == index, "Account who mapping differs")
            refreshed = api.request("/api/collections/users/auth-refresh", "POST", {}, token=auth["token"])
            require(refreshed["record"]["id"] == auth["record"]["id"], "Auth refresh changed identity")
            authentications.append(refreshed)
        passed("both_accounts_auth_and_refresh")

        api.request("/api/collections/users/auth-with-password", "POST", {
            "identity": accounts[0]["email"], "password": secrets.token_urlsafe(30),
        }, expect=400)
        passed("incorrect_password_rejected")

        anonymous = api.request("/api/collections/items/records")
        require(anonymous.get("items") == [], "Anonymous items list revealed records")
        api.request("/api/collections/users/records", "POST", {
            "email": "verify-" + secrets.token_hex(8) + "@example.invalid",
            "password": secrets.token_urlsafe(24), "passwordConfirm": secrets.token_urlsafe(24),
        }, expect=403)
        passed("anonymous_read_hidden_and_registration_disabled")

        streams = [SSE(api, auth["token"]) for auth in authentications]
        token_a, token_b = (auth["token"] for auth in authentications)
        record_id = secrets.token_hex(8)[:15]
        body = {"id": record_id, "kind": "verification", "ref": "verify-" + secrets.token_hex(12),
                "data": {"check": "created", "owner": "deployment-verifier"}}
        created = api.request("/api/collections/items/records", "POST", body, token=token_a)
        item_ids.append(created["id"])
        require(created["id"] == record_id, "Requested item ID not preserved")
        received = streams[1].record_event(record_id, "create")
        require(received["data"]["check"] == "created", "Other account's SSE create differs")
        received = api.request("/api/collections/items/records/" + record_id, token=token_b)
        require(received["data"]["check"] == "created", "Other account cannot read item")
        api.request("/api/collections/items/records/" + record_id, expect=404)
        passed("account_a_create_account_b_read_and_realtime")

        api.request("/api/collections/items/records/" + record_id, "PATCH", {
            "data": {"check": "updated", "owner": "deployment-verifier"},
        }, token=token_b)
        received = streams[0].record_event(record_id, "update")
        require(received["data"]["check"] == "updated", "Other account's SSE update differs")
        received = api.request("/api/collections/items/records/" + record_id, token=token_a)
        require(received["data"]["check"] == "updated", "Updated item is not shared")
        passed("account_b_update_account_a_read_and_realtime")

        api.request("/api/collections/items/records/" + record_id, "DELETE", token=token_a, expect=204)
        streams[1].record_event(record_id, "delete")
        api.request("/api/collections/items/records/" + record_id, token=token_b, expect=404)
        item_ids.remove(record_id)
        passed("shared_delete_and_realtime")

        image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII="
        )
        boundary = "verify" + secrets.token_hex(16)
        multipart = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
                     "filename=\"verification.png\"\r\nContent-Type: image/png\r\n\r\n").encode()
        multipart += image + f"\r\n--{boundary}--\r\n".encode()
        photo = api.request("/api/collections/photos/records", "POST", multipart, token=token_a,
                            headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
        photo_ids.append(photo["id"])
        photo_path = "/api/files/photos/" + photo["id"] + "/" + urllib.parse.quote(photo["file"])
        api.request(photo_path, expect=404)
        file_token = api.request("/api/files/token", "POST", {}, token=token_b)["token"]
        downloaded, _ = api.request(photo_path + "?token=" + urllib.parse.quote(file_token), binary=True)
        require(downloaded == image, "Protected photo bytes differ")
        api.request("/api/collections/photos/records/" + photo["id"], "DELETE", token=token_b, expect=204)
        photo_ids.remove(photo["id"])
        passed("photo_upload_protected_download_other_account_and_delete")

        changed_password = secrets.token_urlsafe(26)
        user_path = "/api/collections/users/records/" + authentications[0]["record"]["id"]
        api.request(user_path, "PATCH", {
            "oldPassword": secrets.token_urlsafe(26),
            "password": changed_password, "passwordConfirm": changed_password,
        }, token=token_a, expect=400)
        api.request(user_path, "PATCH", {
            "oldPassword": accounts[0]["password"],
            "password": changed_password, "passwordConfirm": changed_password,
        }, token=token_a)
        updated_auth = api.auth(accounts[0], changed_password)
        require(updated_auth["record"]["id"] == authentications[0]["record"]["id"],
                "Changed-password login returned another user")
        api.request(user_path, "PATCH", {
            "oldPassword": changed_password,
            "password": accounts[0]["password"], "passwordConfirm": accounts[0]["password"],
        }, token=updated_auth["token"])
        changed_password = None
        authentications[0] = api.auth(accounts[0])
        passed("old_password_required_password_change_and_restore")
    except Exception as error:
        # Only controlled assertion text is emitted; arbitrary library errors can
        # contain full URLs (including protected file query tokens).
        failure = str(error) if isinstance(error, CheckError) else type(error).__name__
    finally:
        for stream in streams:
            stream.close()
        if changed_password:
            try:
                updated_auth = api.auth(accounts[0], changed_password)
                api.request("/api/collections/users/records/" + updated_auth["record"]["id"], "PATCH", {
                    "oldPassword": changed_password,
                    "password": accounts[0]["password"], "passwordConfirm": accounts[0]["password"],
                }, token=updated_auth["token"])
                authentications[0] = api.auth(accounts[0])
            except Exception:
                # Failure before the password update may leave the original password active.
                try:
                    authentications[0] = api.auth(accounts[0])
                except Exception:
                    cleanup_errors.append("Could not confirm account 0 password restoration")
        if item_ids or photo_ids:
            try:
                cleanup_token = api.auth(accounts[1])["token"]
                for collection, ids in (("items", item_ids), ("photos", photo_ids)):
                    for record_id in ids:
                        api.request(f"/api/collections/{collection}/records/{record_id}",
                                    "DELETE", token=cleanup_token, expect=(204, 404))
            except Exception:
                cleanup_errors.append("Could not remove all verifier-created records")

    results.append({"check": "cleanup_and_original_password_restored", "passed": not cleanup_errors})
    return {
        "base_url": api.base_url,
        "passed": failure is None and not cleanup_errors,
        "checks": results,
        "failure": failure,
        "cleanup_errors": cleanup_errors,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--credentials-json", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    parsed = urllib.parse.urlsplit(args.base_url)
    require(parsed.scheme in ("http", "https") and parsed.netloc and not parsed.query and not parsed.fragment,
            "Invalid base URL")
    credentials = json.loads(args.credentials_json.read_text())
    accounts = credentials["accounts"]
    require(len(accounts) == 2 and all(account.get("email") and account.get("password") for account in accounts),
            "Credentials must contain exactly two email/password records")
    result = verify(API(args.base_url), accounts)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(rendered, end="")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
