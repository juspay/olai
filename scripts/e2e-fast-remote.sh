#!/usr/bin/env bash
set -euo pipefail

platform="x86_64-linux"
hosts_file="${ODU_HOSTS:-$HOME/.config/odu/hosts.json}"

if [[ ! -f "$hosts_file" ]]; then
  echo "e2e-fast-remote: hosts file not found: $hosts_file" >&2
  exit 1
fi

# Match odu's inventory grammar: a platform may name one host or a non-empty
# pool. Validate before mapfile because a failed process substitution does not
# make mapfile fail.
hosts_json="$({
  jq -ce --arg platform "$platform" '
    if has($platform) | not then
      error("no host pool for " + $platform)
    elif .[$platform] | type == "string" then
      if .[$platform] == "" then error("host must not be empty")
      else [.[$platform]] end
    elif .[$platform] | type == "array" then
      if .[$platform] | length == 0 then error("host pool must not be empty")
      elif all(.[$platform][]; type == "string" and length > 0) then .[$platform]
      else error("host pool must contain only non-empty strings") end
    else
      error("host pool must be a string or array")
    end
  ' "$hosts_file"
} 2>&1)" || {
  echo "e2e-fast-remote: invalid $hosts_file: $hosts_json" >&2
  exit 1
}
mapfile -t hosts < <(jq -r '.[]' <<<"$hosts_json")

declare -A seen=()
for host in "${hosts[@]}"; do
  if [[ -n "${seen[$host]:-}" ]]; then
    echo "e2e-fast-remote: duplicate host in $hosts_file: $host" >&2
    exit 1
  fi
  seen[$host]=1
done

started=$SECONDS
repo="$(git rev-parse --show-toplevel)"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/olai-e2e-remote.XXXXXX")"
run_id="$(printf '%(%Y%m%dT%H%M%S)T' -1)-$$"
remote_dir="/tmp/olai-e2e-$run_id"
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10)
staged_hosts=()

cleanup() {
  local host pid
  local -a cleanup_pids=()
  set +e
  for pid in $(jobs -pr); do
    kill "$pid" 2>/dev/null
  done
  for host in "${staged_hosts[@]}"; do
    ssh "${ssh_opts[@]}" "$host" "rm -rf -- '$remote_dir'" >/dev/null 2>&1 &
    cleanup_pids+=("$!")
  done
  for pid in "${cleanup_pids[@]}"; do
    wait "$pid"
  done
  rm -rf -- "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Checking ${#hosts[@]} $platform hosts from $hosts_file..."
probe_pids=()
for i in "${!hosts[@]}"; do
  host="${hosts[$i]}"
  (
    ssh "${ssh_opts[@]}" "$host" \
      'command -v nix >/dev/null && nix store info >/dev/null && nix --version' \
      >"$scratch/probe.$i.out" 2>"$scratch/probe.$i.err"
  ) &
  probe_pids[$i]=$!
done

probe_failed=0
for i in "${!hosts[@]}"; do
  if wait "${probe_pids[$i]}"; then
    printf '  %-24s %s\n' "${hosts[$i]}" "$(<"$scratch/probe.$i.out")"
  else
    printf '  %-24s unavailable\n' "${hosts[$i]}" >&2
    sed 's/^/    /' "$scratch/probe.$i.out" "$scratch/probe.$i.err" >&2
    probe_failed=1
  fi
done
if ((probe_failed)); then
  echo "e2e-fast-remote: every configured host is required; no partial suite was run" >&2
  exit 1
fi
staged_hosts=("${hosts[@]}")

# Carry precisely Git's worktree: tracked files plus untracked files which are
# not ignored. A deleted tracked path is absent from the archive, as it is from
# the worktree being tested.
while IFS= read -r -d '' path; do
  if [[ -e "$repo/$path" || -L "$repo/$path" ]]; then
    printf '%s\0' "$path"
  fi
done < <(git -C "$repo" ls-files --cached --others --exclude-standard -z) \
  >"$scratch/files"
tar -C "$repo" --null --files-from="$scratch/files" -czf "$scratch/worktree.tar.gz"

echo "Copying the current worktree..."
copy_pids=()
for i in "${!hosts[@]}"; do
  host="${hosts[$i]}"
  (
    ssh "${ssh_opts[@]}" "$host" \
      "mkdir -p '$remote_dir' && tar -xzf - -C '$remote_dir'" \
      <"$scratch/worktree.tar.gz" >"$scratch/copy.$i" 2>&1
  ) &
  copy_pids[$i]=$!
done

copy_failed=0
for i in "${!hosts[@]}"; do
  if wait "${copy_pids[$i]}"; then
    :
  else
    echo "e2e-fast-remote: copy to ${hosts[$i]} failed:" >&2
    sed 's/^/  /' "$scratch/copy.$i" >&2
    copy_failed=1
  fi
done
if ((copy_failed)); then
  echo "e2e-fast-remote: every configured host is required; no partial suite was run" >&2
  exit 1
fi

shards=${#hosts[@]}
run_pids=()
echo "Running $shards shards (four Cucumber workers per host)..."
for i in "${!hosts[@]}"; do
  host="${hosts[$i]}"
  shard="$((i + 1))/$shards"
  echo "  [$shard] $host"
  (
    ssh "${ssh_opts[@]}" "$host" \
      "set -e
       cd '$remote_dir'
       nix develop . --accept-flake-config -c sh -c '
         git init -q
         git add -A
         GIT_AUTHOR_DATE=1970-01-01T00:00:00Z \
         GIT_COMMITTER_DATE=1970-01-01T00:00:00Z \
           git -c user.name=e2e-fast-remote \
             -c user.email=e2e-fast-remote@invalid commit -qm worktree
       '
       CUCUMBER_SHARD='$shard' nix develop . --accept-flake-config -c just e2e" \
      >"$scratch/run.$i" 2>&1
  ) &
  run_pids[$i]=$!
done

run_failed=0
for i in "${!hosts[@]}"; do
  shard="$((i + 1))/$shards"
  if wait "${run_pids[$i]}"; then
    summary="$(grep -E '^[0-9]+ scenarios? \(' "$scratch/run.$i" | tail -1 || true)"
    printf '  [%s] %-20s %s\n' "$shard" "${hosts[$i]}" "${summary:-passed}"
  else
    echo "e2e-fast-remote: shard $shard failed on ${hosts[$i]}:" >&2
    sed 's/^/  /' "$scratch/run.$i" >&2
    run_failed=1
  fi
done

elapsed=$((SECONDS - started))
if ((run_failed)); then
  echo "e2e-fast-remote: failed after ${elapsed}s" >&2
  exit 1
fi
echo "e2e-fast-remote: all $shards shards passed in ${elapsed}s"
