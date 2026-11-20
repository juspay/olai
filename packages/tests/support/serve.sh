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

olai_serve() {
  local root=$1
  local vault=$2
  local log=$3
  local port=${PORT:-0}
  unset OLAI_URL
  OLAI_DIST_DIR="$root/packages/web/dist" KOLU_ACP_AGENT="${AGENT:-}" \
    OLAI_AGENT_PATH= \
    OLAI_DIE_WITH_PARENT=$$ \
    bun "$root/packages/server/src/main.ts" web "$vault" --port "$port" \
    > "$log" 2>&1 &
  OLAI_SERVER=$!
  for _ in $(seq 1 60); do
    # Only a newline-terminated log is complete: a cut inside `url=` would
    # otherwise match a truncated port.
    [ -z "$(tail -c1 "$log" 2>/dev/null)" ] || continue
    OLAI_URL=$(grep 'message=serving' "$log" 2>/dev/null \
      | grep -oE 'url=https?://(127\.0\.0\.1|\[::1\]):[0-9]+' \
      | head -n1 \
      | sed 's/^url=//' || true)
    if [ -n "${OLAI_URL:-}" ]; then
      return 0
    fi
    sleep 0.25
  done
  echo "the olai server never said where it was serving." >&2
  echo "server log ($log):" >&2
  cat "$log" >&2 || true
  unset OLAI_URL
  return 1
}
