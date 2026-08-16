#!/usr/bin/env bash
# Run the suite over and over on a BUSY box, and say what it dropped.
#
#   RUNS=6 SUITES=5 sh underload.sh    # five suites at once, six rounds each
#   RUNS=20 BUSY=48 sh underload.sh    # one suite, forty-eight busy loops
#   RUNS=20 BUSY=48 FEATURES='features/undo.feature' sh underload.sh
#
# Expects to be run from packages/tests, inside `nix develop .#e2e`, with
# OLAI_BIN pointing at a built binary — the same three things the README's
# by-hand recipe asks for:
#
#   export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"
#
# THE TWO KNOBS ARE TWO DIFFERENT QUESTIONS, and running them separately is
# the whole reason both exist. BUSY pins the cores and leaves this the only
# suite on the box: whatever fails under it failed on LOAD. SUITES starts
# several suites at once, which is what a box shared by several worktrees
# actually looks like, and is the only way to reach the failures that need a
# STRANGER on the machine rather than a slow one. A run mixing them cannot say
# which of the two it found.
#
# Every run leaves its own cucumber message stream, and `underload.ts` reads
# them back into a census — a scenario dropped once in thirty runs is the shape
# of this bug, so counting is the point and reading a log is not.
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

# The busy loops go first and die with this script — a `trap` on EXIT rather
# than a `kill` at the end, so an interrupted run does not leave the box
# spinning for the next person. BUSY=0 leaves nothing to kill and no trap,
# which is not the same as a trap with no arguments.
loops=""
for _ in $(seq 1 "$busy"); do
  bash -c 'while :; do :; done' &
  loops="$loops $!"
done
if [ -n "$loops" ]; then
  # shellcheck disable=SC2064  # $loops is wanted as it is NOW, not at exit
  trap "kill $loops 2>/dev/null" EXIT INT TERM
fi

# One suite's rounds, sequentially. Several of these run at once when SUITES>1.
one_suite() {
  local suite=$1 i rc start
  for i in $(seq 1 "$runs"); do
    start=$(date +%s)
    # shellcheck disable=SC2086  # $features is a LIST of paths, or nothing
    bun run test --format "message:$out/s$suite-r$i.ndjson" $features \
      > "$out/s$suite-r$i.out" 2> "$out/s$suite-r$i.err"
    rc=$?
    echo "suite=$suite round=$i rc=$rc secs=$(( $(date +%s) - start ))" \
      >> "$out/index"
  done
}

for suite in $(seq 1 "$suites"); do
  one_suite "$suite" &
done
wait

echo
bun underload.ts "$out"
