#!/usr/bin/env bash
# mstocks contract bootstrap — ensures Node >= 22 and installs dependencies.
# The wallet-sdk needs Node >= 22 (ES2025 Set methods); npm install applies the
# wallet-sdk-shielded patch automatically (postinstall → patch-package).
# Safe to re-run. On macOS just install Node 22+ yourself and run `npm install`.
set -euo pipefail
cd "$(dirname "$0")"

need_node() {
  ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v(2[2-9]|[3-9][0-9])'
}

if need_node; then
  if [ ! -x .cache/node22/bin/node ]; then
    echo "[bootstrap] Node >= 22 not found — fetching Node 22 LTS (linux-x64) into .cache/node22…"
    mkdir -p .cache
    VER=$(curl -s https://nodejs.org/dist/latest-v22.x/ | grep -oE 'node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.gz' | head -1)
    curl -sL -o .cache/node22.tar.gz "https://nodejs.org/dist/latest-v22.x/$VER"
    tar xzf .cache/node22.tar.gz -C .cache
    rm -rf .cache/node22 && mv .cache/node-v22.*-linux-x64 .cache/node22
    rm .cache/node22.tar.gz
  fi
  export PATH="$PWD/.cache/node22/bin:$PATH"
fi

echo "[bootstrap] node $(node --version)"
npm install
echo "[bootstrap] done. Check the wallet with:  npm run balance"
echo "[bootstrap] deploy + export with:         npm run deploy"
