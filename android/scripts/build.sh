#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "$HOME/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home" ]; then
    export JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
  elif command -v /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  fi
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
exec ./gradlew --no-daemon --console=plain assembleRelease "$@"
