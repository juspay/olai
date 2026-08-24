#!/usr/bin/env bash
# Run each section of evidence.ts against a FRESH directory and a FRESH server.
#
#   SHOTS=/somewhere bash evidence.sh
#   PORT=7801 SHOTS=/somewhere bash evidence.sh   # pin a port (optional)
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with the
# client already built (`just build-client`).
#
# How a server is stood up — port 0 by default, a private file the bound
# URL is written to — is `support/serve.sh`'s, shared with wire.sh: one
# spelling of the boot, so a driver cannot end up photographing a server
# that was never started, or another worktree's.
set -euo pipefail

. support/serve.sh

root=$(cd ../.. && pwd)
shots=${SHOTS:-$PWD/shots}

if [ -n "${PORT:-}" ]; then
  olai_port_free "$PORT" "the shots"
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$shots"

for section in $(SECTION= bun evidence.ts); do
  echo
  echo "── $section ──────────────────────────────────────────────"
  rm -rf "$work/vault"
  mkdir -p "$work/vault"
  cp -r fixtures/good/. "$work/vault/"
  # AN AGENT FOR THE ONE SECTION THAT TALKS TO ONE, and none for the rest:
  # a scripted agent nobody speaks to is a subprocess spawned per section for
  # nothing (support/serve.sh says so where the switch lives). The scripted one
  # rather than the real adapter, because a shot has to be reproducible and a
  # real monitor keeps its own clock.
  case "$section" in
    a-background-task-*) agent="$PWD/agent/fake-acp-agent.ts" ;;
    *) agent="" ;;
  esac
  # ... and it has to be in the ENVIRONMENT before the spawn, not on the line
  # that drives the browser: it is the SERVER that is given an agent.
  export AGENT="$agent"
  olai_serve "$root" "$work/vault" "$work/server.log"
  SECTION="$section" BASE="$OLAI_URL" SHOTS="$shots" \
    VAULT="$work/vault" bun evidence.ts
  kill "$OLAI_SERVER" 2>/dev/null || true
  wait "$OLAI_SERVER" 2>/dev/null || true
done

echo
echo "shots in $shots"
