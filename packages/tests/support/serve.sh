# A dev server for a DRIVER — the shell half of `../evidence.sh` and
# `../wire.sh`, which are the two scripts in this package that stand olai up
# outside the suite.
#
#   . support/serve.sh
#   olai_serve "$root" "$vault" "$log"   # spawn, wait for it to answer
#   # $OLAI_SERVER is the pid; $OLAI_URL is the bound address
#   kill "$OLAI_SERVER"
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
#
# Port 0 by default. A fixed PORT= used to be how two worktrees photographed
# or measured one tree: the second spawn failed, the readiness curl succeeded
# against the stranger, and every number or screenshot was of the other
# branch. The bound address is written to a private file and read back —
# the same seam `just run` uses — so two worktrees cannot collide.

# Refuse a port something else is already serving. Only for an explicit
# PORT=: port 0 is the default and cannot collide this way. `what` names
# what would otherwise be silently wrong.
olai_port_free() {
  local port=$1
  local what=${2:-the run}
  if ss -ltn 2>/dev/null | grep -q "127.0.0.1:$port "; then
    echo "port $port is already taken — another worktree's server, most" >&2
    echo "likely. Re-run with PORT=<free port> or unset PORT (the default" >&2
    echo "asks the OS); $what would otherwise be of whatever is already" >&2
    echo "serving there." >&2
    return 1
  fi
}

# Spawn `olai web <vault>` from the working tree at `root`, wait until it
# answers, and leave the pid in `$OLAI_SERVER` and the bound address in
# `$OLAI_URL` for the caller.
#
# `OLAI_ACP_AGENT=` empty: a driver is not a chat scenario, and an agent it
# never speaks to is a process spawned for nothing. `OLAI_DIST_DIR` is the
# client that `just build-client` wrote into that same worktree — the one thing
# a driver has to be pointed at, and the one thing that makes `root` a knob
# rather than a constant.
#
# `PORT` if set is passed through as `--port`; unset is 0, which is the
# default and the right one.
olai_serve() {
  # `local`, so a caller's own `root` or `port` is not clobbered by calling
  # this: both scripts happen to pass the same values under the same names,
  # which is exactly how that stops being true one edit later.
  local root=$1
  local vault=$2
  local log=$3
  local port=${PORT:-0}
  local port_file
  port_file=$(mktemp)
  OLAI_DIST_DIR="$root/packages/web/dist" OLAI_ACP_AGENT= \
    OLAI_PORT_FILE="$port_file" \
    bun "$root/packages/server/src/main.ts" web "$vault" --port "$port" \
    > "$log" 2>&1 &
  OLAI_SERVER=$!
  # Fifteen seconds of quarter-seconds. A boot that never answers is left to
  # the driver to fail on, with the log this wrote beside it: a readiness loop
  # that exits non-zero here would report "the server did not start" for what
  # is usually "the vault is not what you think it is".
  for _ in $(seq 1 60); do
    if [ -s "$port_file" ]; then
      OLAI_URL=$(tr -d '\n' < "$port_file")
      rm -f "$port_file"
      return 0
    fi
    sleep 0.25
  done
  rm -f "$port_file"
}
