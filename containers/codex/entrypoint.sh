#!/bin/bash
set -euo pipefail
cd /workspace
# The Linux dependency volume hides the Mac's node_modules directory.
if ! sha256sum --status -c node_modules/.tron-dependency-hash 2>/dev/null; then
  npm ci
  sha256sum package.json package-lock.json > node_modules/.tron-dependency-hash
fi
mkdir -p "$CODEX_HOME" test-results
# Device login does not need game servers or access to the host's credentials.
if [[ "${1:-}" == codex && "${2:-}" == login ]]; then
  exec "$@"
fi
# Keep both historical test ports available; host access uses 5183/5184.
for port in 5173 5174; do
  node node_modules/vite/bin/vite.js --host 0.0.0.0 --port "$port" --strictPort > "/tmp/tron-vite-$port.log" 2>&1 &
  ready=0
  for attempt in {1..100}; do
    if curl --fail --silent "http://127.0.0.1:$port/" > /dev/null; then ready=1; break; fi
    sleep .1
  done
  if [[ "$ready" != 1 ]]; then cat "/tmp/tron-vite-$port.log"; exit 1; fi
done
exec "$@"
