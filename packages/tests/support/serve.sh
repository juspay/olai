# A dev server for a DRIVER — the shell half of `../evidence.sh` and
# `../wire.sh`, which are the two scripts in this package that stand olai up
# outside the suite.
#
#   . support/serve.sh
#   olai_port_free 7799 "the shots"      # refuse a port somebody else holds
#   olai_serve "$root" "$vault" 7799 "$log"   # spawn, wait for it to answer
#   kill "$OLAI_SERVER"                       # …and the pid it left behind
#
# Sourced rather than executed, because a spawned server has to outlive the
# call: the caller needs the pid to kill afterwards. There is no third caller
# and no ambition to have one — what this holds is the ONE spelling of how a
# dev server boots (which env vars, which entry file, which flag), and the
# reason it is not written twice is that when that spelling changes, the copy
# nobody edited goes on booting nothing while its driver measures or
# photographs whatever is already listening.
#
# The suite itself does NOT come through here: it drives the NIX-BUILT binary
# through `support/hooks.ts` (`OLAI_BIN`), which is what a user actually runs.
# These are drivers, and a driver runs the working tree.

# Refuse a port something else is already serving. `what` names what would
# otherwise be silently wrong, since that is the whole cost of not checking:
# this repo is worked in several git WORKTREES at once, and a fixed port means
# the second one drives the FIRST one's server — the spawn below fails, the
# readiness curl succeeds against the stranger, and every number or screenshot
# is of the other branch. Not hypothetical; it cost two evidence runs.
olai_port_free() {
  local port=$1
  local what=${2:-the run}
  if ss -ltn 2>/dev/null | grep -q "127.0.0.1:$port "; then
    echo "port $port is already taken — another worktree's server, most" >&2
    echo "likely. Re-run with PORT=<free port>; $what would otherwise be of" >&2
    echo "whatever is already serving there." >&2
    return 1
  fi
}

# Spawn `olai web <vault>` from the working tree at `root`, wait until it
# answers, and leave the pid in `$OLAI_SERVER` for the caller to kill.
#
# `OLAI_ACP_AGENT=` empty: a driver is not a chat scenario, and an agent it
# never speaks to is a process spawned for nothing. `OLAI_DIST_DIR` is the
# client that `just build-client` wrote into that same worktree — the one thing
# a driver has to be pointed at, and the one thing that makes `root` a knob
# rather than a constant.
olai_serve() {
  # `local`, so a caller's own `root` or `port` is not clobbered by calling
  # this: both scripts happen to pass the same values under the same names,
  # which is exactly how that stops being true one edit later.
  local root=$1
  local vault=$2
  local port=$3
  local log=$4
  OLAI_DIST_DIR="$root/packages/web/dist" OLAI_ACP_AGENT= \
    bun "$root/packages/server/src/main.ts" web "$vault" --port "$port" \
    > "$log" 2>&1 &
  OLAI_SERVER=$!
  # Fifteen seconds of quarter-seconds. A boot that never answers is left to
  # the driver to fail on, with the log this wrote beside it: a readiness loop
  # that exits non-zero here would report "the server did not start" for what
  # is usually "the vault is not what you think it is".
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:$port/" && break
    sleep 0.25
  done
}
