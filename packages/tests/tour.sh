#!/usr/bin/env bash
# Run through `just website-tour`, which builds the client and enters the
# `.#e2e` shell that has Playwright's browsers.
set -euo pipefail

cd "$(dirname "$0")"
. support/serve.sh

repo=$(cd ../.. && pwd)
public="$repo/website/public"
what=${1:-all}

unset PADI_SOCKET OLAI_MAIL_OAUTH_CLIENT OLAI_MAIL_OAUTH_SECRET GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

root=""
stop() {
  if [ -n "${OLAI_SERVER:-}" ]; then
    kill "$OLAI_SERVER" 2>/dev/null || true
    wait "$OLAI_SERVER" 2>/dev/null || true
    unset OLAI_SERVER
  fi
  if [ -n "$root" ]; then
    rm -rf "$root"
    root=""
  fi
}
trap stop EXIT

under_root() {
  case $2 in
    "$root"/*) ;;
    *)
      echo "refusing to start the server: $1=$2 is outside $root" >&2
      return 1
      ;;
  esac
}

tour() {
  local mode=$1
  root=$(mktemp -d /tmp/olai-tour.XXXXXX)
  mkdir -p "$root"/{vault,home,state,config,data,cache,out}
  mkdir -m 700 "$root/runtime"

  cp -R fixtures/tour/. "$root/vault"
  bun tour.ts shift "$root/vault"

  local home="$root/home" state="$root/state"
  local git=(env HOME="$home" XDG_CONFIG_HOME="$root/config" GIT_CONFIG_NOSYSTEM=1 git -C "$root/vault")
  "${git[@]}" init -q
  "${git[@]}" config user.name "olai tour"
  "${git[@]}" config user.email tour@example.com
  "${git[@]}" config commit.gpgsign false
  "${git[@]}" add -A
  "${git[@]}" commit -qm "The tour's directory"

  under_root HOME "$home"
  under_root XDG_STATE_HOME "$state"
  echo "vault:   $root/vault"
  echo "home:    $home"
  echo "state:   $state"
  echo "config:  $root/config"
  echo "data:    $root/data"
  echo "cache:   $root/cache"
  echo "runtime: $root/runtime"

  HOME="$home" \
    XDG_STATE_HOME="$state" \
    XDG_CONFIG_HOME="$root/config" \
    XDG_DATA_HOME="$root/data" \
    XDG_CACHE_HOME="$root/cache" \
    XDG_RUNTIME_DIR="$root/runtime" \
    ODU_WEB_ORIGIN=http://127.0.0.1:1 \
    OLAI_ACP_CODEX= OLAI_ACP_PI= OLAI_HIMALAYA= \
    OLAI_HOSTNAME=laptop \
    AGENT="$PWD/tour-agent.ts" \
    olai_serve "$repo" "$root/vault" "$root/server.log"
  echo "server:  $OLAI_URL"

  BASE="$OLAI_URL" OUT="$root/out" bun tour.ts "$mode"
  mkdir -p "$public/tour"
  cp "$root/out"/* "$public/tour/"
  stop
}

case $what in
  card) bun tour.ts card "$public/og.html" "$public/og.png" ;;
  stills) tour stills ;;
  all)
    bun tour.ts card "$public/og.html" "$public/og.png"
    tour stills
    ;;
  *)
    echo "usage: tour.sh [card|stills]" >&2
    exit 2
    ;;
esac
