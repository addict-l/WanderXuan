#!/usr/bin/env python3
"""Check the actual release APK without loading signing secrets."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import subprocess
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = {"characters-preview.html", "fp-ui-preview.html"}
PROTECTED = ("js/characters.js", "js/fp-ui.js", "css/fp-ui.css")
SERVER_SETTING = re.compile(r'''(?m)^(\s*server\s*:\s*)(?:'[^']*'|"[^"]*")(\s*,?\s*)$''')


def config_for_server(source, server):
    """Match the single build-time override and preserve the remaining config."""
    matches = list(SERVER_SETTING.finditer(source))
    assert len(matches) == 1, "Expected one server setting in source config"
    return SERVER_SETTING.sub(lambda match: match.group(1) + json.dumps(server) + match.group(2), source)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--test-server", help="Require the isolated candidate package and this HTTPS server")
    args = parser.parse_args()
    test_server = None
    if args.test_server is not None:
        try:
            parsed = urllib.parse.urlsplit(args.test_server)
            valid = (parsed.scheme == "https" and bool(parsed.hostname)
                     and parsed.username is None and parsed.password is None
                     and "?" not in args.test_server and "#" not in args.test_server
                     and args.test_server == args.test_server.strip()
                     and parsed.port != 0)
        except ValueError:
            valid = False
        if not valid:
            parser.error("--test-server must be an HTTPS URL without credentials, query or fragment")
        test_server = args.test_server.rstrip("/")
    apk = args.apk.resolve()
    sdk = Path(os.environ.get("ANDROID_HOME", Path.home() / "Library/Android/sdk"))
    build_tools = sdk / "build-tools/35.0.0"
    env = os.environ.copy()
    java21 = Path.home() / "Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
    if "JAVA_HOME" not in env and java21.exists():
        env["JAVA_HOME"] = str(java21)

    badging = subprocess.check_output([str(build_tools / "aapt"), "dump", "badging", str(apk)], text=True, env=env)
    package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    expected_package = "cn.coupleroom.app.preview" if test_server else "cn.coupleroom.app"
    expected_label = "双人小屋验收版" if test_server else "双人小屋"
    assert package and package.groups() == (expected_package, "3", "1.1.0"), "Unexpected package or version"
    assert "application-label:'" + expected_label + "'" in badging, "Unexpected application label"
    signature = subprocess.check_output([str(build_tools / "apksigner"), "verify", "--verbose", "--print-certs", str(apk)], text=True, env=env)
    certificate = re.search(r"Signer #1 certificate SHA-256 digest: (\w+)", signature)
    assert certificate and certificate.group(1) == "92bf2d453e30f4cc5bacd311754df1e9501810bcca95933321c4bf1dc4bce2d3", "Signing certificate differs from installed releases"

    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        assert not any(Path(name).name in PREVIEWS for name in names), "Preview page found in APK"
        expected = {"assets/www/" + path.relative_to(ROOT / "web").as_posix(): path
                    for path in (ROOT / "web").rglob("*") if path.is_file() and path.name not in PREVIEWS}
        actual = {name for name in names if name.startswith("assets/www/") and not name.endswith("/")}
        assert actual == set(expected), "Missing or stale web assets in APK"
        for name, path in expected.items():
            content = path.read_bytes()
            if test_server and name == "assets/www/config.js":
                content = config_for_server(content.decode(), test_server).encode()
            assert archive.read(name) == content, "Web asset differs: " + name
        source_config = subprocess.check_output(["git", "show", "origin/ui/characters:web/config.js"], cwd=ROOT)
        assert source_config == (ROOT / "web/config.js").read_bytes(), "Build-time test server changed source config"
        for rel in PROTECTED:
            source = subprocess.check_output(["git", "show", "origin/ui/characters:web/" + rel], cwd=ROOT)
            assert source == (ROOT / "web" / rel).read_bytes(), "Protected UI source changed: " + rel
        assert not any(name.endswith((".jks", ".keystore", ".db", ".properties")) or "credentials" in name.lower()
                       for name in names if name.startswith("assets/")), "Private material found in assets"

    result = {"passed": True, "package": package.group(1), "version_code": int(package.group(2)),
              "version": package.group(3), "apk_bytes": apk.stat().st_size,
              "apk_sha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
              "certificate_sha256": certificate.group(1), "web_assets_match_source": len(expected),
              "preview_pages_excluded": sorted(PREVIEWS), "protected_ui_source_unchanged": list(PROTECTED),
              "isolated_test_package": bool(test_server), "test_server": test_server}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
