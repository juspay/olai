#!/usr/bin/env bash
set -uo pipefail

runs=${RUNS:-5}
suites=${SUITES:-1}
busy=${BUSY:-0}
out=${OUT:-reports/under-load}
features=${FEATURES:-}

if [ -z "${OLAI_BIN:-}" ]; then
  echo "OLAI_BIN is unset — this loop spawns the binary a user runs, not a" >&2
  echo "dev-shell server. Build one and point it here:" >&2
  echo '  export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"' >&2
  exit 1
fi

mkdir -p "$out"

loops=()
for _ in $(seq 1 "$busy"); do
  bash -c 'while :; do :; done' &
  loops+=("$!")
done
if [ "${#loops[@]}" -gt 0 ]; then
  trap 'kill "${loops[@]}" 2>/dev/null' EXIT INT TERM
fi

read -r -a features <<< "$features"

one_suite() {
  local suite=$1 i rc start
  for i in $(seq 1 "$runs"); do
    start=$(date +%s)
    bun run test --format "message:$out/s$suite-r$i.ndjson" "${features[@]}" \
      > "$out/s$suite-r$i.out" 2> "$out/s$suite-r$i.err"
    rc=$?
    echo "suite=$suite round=$i rc=$rc secs=$(( $(date +%s) - start ))" \
      >> "$out/index"
  done
}

suite_pids=()
for suite in $(seq 1 "$suites"); do
  one_suite "$suite" &
  suite_pids+=("$!")
done
wait "${suite_pids[@]}"

echo
bun underload.ts "$out"
