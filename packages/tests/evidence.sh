#!/usr/bin/env bash
# Run each section of evidence.ts against a FRESH directory and a FRESH server.
#
#   SHOTS=/somewhere bash evidence.sh
#   PORT=7801 SHOTS=/somewhere bash evidence.sh   # pin a port (optional)
#   SHOTS=/somewhere bash evidence.sh a-section another   # just these
#
# Named sections rather than all of them, because one of them needs something
# the rest do not and costs real money: `chat-sends-queue` drives a REAL agent
# (`AGENT=$(sh scripts/acp-agent.sh)`) through four turns of a real model.
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

# Named on the command line, or every one the driver knows. The array is what
# keeps "one name with a hyphen in it" and "the whole list" the same shape.
sections=("$@")
if [ ${#sections[@]} -eq 0 ]; then
  # Word splitting is the point: the driver prints one name per line.
  # shellcheck disable=SC2207
  sections=($(SECTION= bun evidence.ts))
fi

for section in "${sections[@]}"; do
  echo
  echo "── $section ──────────────────────────────────────────────"
  rm -rf "$work/vault"
  mkdir -p "$work/vault"
  # WHICH CORPUS this section is served. `good/` for all but one of them, and
  # that one is not a preference: a property DECLARATION fences its key across
  # the whole vault, so typing `pr` in `good/` would make its
  # `pr: https://…/179` a broken file and take every other section's shots with
  # it (`fixtures/README.md` says why there are two vaults).
  case "$section" in
    typed-properties) corpus="typed" ;;
    *) corpus="good" ;;
  esac
  cp -r "fixtures/$corpus/." "$work/vault/"
  # AN AGENT FOR THE SECTIONS THAT TALK TO ONE, and none for the rest:
  # a scripted agent nobody speaks to is a subprocess spawned per section for
  # nothing (support/serve.sh says so where the switch lives). The scripted one
  # rather than the real adapter, because a shot has to be reproducible and a
  # real monitor keeps its own clock.
  case "$section" in
    a-background-task-*|markdown-waits-illegibly) agent="$PWD/agent/fake-acp-agent.ts" ;;
    # ... and the two sections whose subject is what a REAL harness does keep
    # whatever the caller handed in, which is the whole of how they are run
    # (each says so in its own docstring: AGENT=$(sh ../../scripts/acp-agent.sh)).
    # This arm was missing, so the documented command exported an empty AGENT
    # over the caller and the section met a panel with no agent at all.
    chat-sends-queue|chat-agent-resumed) agent="${AGENT:-}" ;;
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
