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

switched_off() {
  if ! grep -q "\"id\":\"$1\".*\"on\":\"no\"" "$root/vault/_olai/Settings.olai"; then
    echo "refusing to start the server: _olai/Settings.olai does not switch $1 off" >&2
    return 1
  fi
}

tour() {
  local mode=$1
  root=$(mktemp -d /tmp/olai-tour.XXXXXX)
  mkdir -p "$root"/{vault,home,state,config,data,cache,out,raw}
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
  switched_off kolu
  switched_off odu
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

  BASE="$OLAI_URL" OUT="$root/out" RAW="$root/raw" bun tour.ts "$mode"
  if [ "$mode" = recording ]; then encode "$root/raw" "$root/out"; fi
  mkdir -p "$public/tour"
  cp "$root/out"/* "$public/tour/"
  stop
}

within() {
  local size
  size=$(wc -c < "$1")
  echo "$(basename "$1"): $size bytes"
  if [ "$size" -gt "$2" ]; then
    echo "$(basename "$1") is over the limit of $2 bytes" >&2
    return 1
  fi
}

encode() {
  local raw=$1 out=$2 lead ffmpeg
  ffmpeg=$(nix build --impure --expr "(import $repo/nix/nixpkgs.nix { }).ffmpeg.bin" --no-link --print-out-paths --accept-flake-config)/bin/ffmpeg
  lead=$(cat "$raw/lead")
  "$ffmpeg" -loglevel error -y -ss "$lead" -i "$raw/take.webm" -an \
    -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 "$out/tour.webm"
  "$ffmpeg" -loglevel error -y -ss "$lead" -i "$raw/take.webm" -an \
    -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart "$out/tour.mp4"
  "$ffmpeg" -loglevel error -y -ss "$lead" -i "$raw/take.webm" -frames:v 1 "$out/tour-poster.png"
  within "$out/tour.webm" 1048576
  within "$out/tour.mp4" 1048576
  within "$out/tour-poster.png" 204800
}

case $what in
  card) bun tour.ts card "$public/og.html" "$public/og.png" ;;
  stills | recording) tour "$what" ;;
  all)
    bun tour.ts card "$public/og.html" "$public/og.png"
    tour stills
    tour recording
    ;;
  *)
    echo "usage: tour.sh [card|stills|recording]" >&2
    exit 2
    ;;
esac
