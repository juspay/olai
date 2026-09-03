#!/usr/bin/env bash
set -euo pipefail

# Rebuild ../patches/pi-mcp-servers.patch.
#
# Same discipline as the sibling rig (packages/plugins/claude/acp/session-list-info/regenerate.sh —
# its header names the failures this shape exists to answer): the patch is
# machine-diffed against pi-acp's PRISTINE dist/index.js after the four
# splices below land by ANCHOR, never by line number; `patch -p1 -F0` at
# the build is the promise that a pin bump fails HERE rather than wires
# half silently.
#
# The four splice points, all against the pinned 0.0.33 bundle:
#
#   1. `PiRpcProcess.spawn` — after the args line: this pin's bridge is
#      `PI_ACP_MCP_EXTENSION` (set by nix/acp-agent.nix's wrapper): when it
#      names a file and the request handed mcpServers, pi gets `-e <file>`
#      and the session's process env carries PI_ACP_MCP_SERVERS as JSON —
#      the same hand-off the seeded SKILL/AGENT env uses, one process per
#      session being exactly the shape that makes per-session env safe.
#   2. `sessions.create` — pass `params.mcpServers` into that spawn.
#   3. `session/load`'s restore — same, from `opts?.mcpServers`.
#   4. `initialize` — `mcpCapabilities: { http, sse }` answers true when
#      the bridge is armed, because that is when the adapter honors them;
#      without the env the pin answers false-false, which stays a fact.
#
#     bash packages/plugins/pi/acp/mcp-bridge/regenerate.sh

# WHERE THIS RIG SITS, since the agents phase moved it: this directory is
# `packages/plugins/pi/acp/mcp-bridge/`, so the plugin's own `acp/` is one up
# and the REPOSITORY is four. The npm shim whose lockfile pins the version is
# still the shared one at the repository root (`acp/README.md` says why one
# lockfile carries three adapters).
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../../.." && pwd)"
out="$here/../patches/pi-mcp-servers.patch"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

version="$(jq -r '.packages["node_modules/pi-acp"].version' "$repo/acp/package-lock.json")"
if [[ -z "$version" || "$version" == "null" ]]; then
  echo "no pin found in acp/package-lock.json" >&2
  exit 1
fi
curl -sfSL "https://registry.npmjs.org/pi-acp/-/pi-acp-$version.tgz" -o "$work/pkg.tgz"
mkdir "$work/pkg"
tar -xzf "$work/pkg.tgz" -C "$work/pkg" package/dist/index.js
bundle="$work/pkg/package/dist/index.js"
echo "source bundle: pristine pi-acp $version"

cp "$bundle" "$work/original.js"

# ── the spliced text: four blocks, each pulled in by anchor at rebuild ──

cat > "$work/spawnHead.js" <<'BLOCK'
    const args = ["--mode", "rpc", "--no-themes"];
    // olai patch (pi-mcp-servers), first half — the bridge THE PIN ships:
    // when the wrapper armed PI_ACP_MCP_EXTENSION and the request handed
    // tool servers, this session's pi loads the bridge and its process env
    // carries the servers as JSON. mcpServers beyond this point have
    // reached pi; what pi does with the bridge's registerTool'd surface is
    // the agent's own answer. Regenerate with
    // `bash packages/plugins/pi/packages/plugins/pi/acp/mcp-bridge/regenerate.sh` — editing this text in the patch
    // file is the drift the tooling exists to remove.
    const mcpExtension = typeof process.env.PI_ACP_MCP_EXTENSION === "string" ? process.env.PI_ACP_MCP_EXTENSION : "";
    const mcpServers = Array.isArray(params.mcpServers) ? params.mcpServers : [];
    const childEnv = mcpExtension !== "" && mcpServers.length > 0
      ? { ...process.env, PI_ACP_MCP_SERVERS: JSON.stringify(mcpServers) }
      : void 0;
    if (childEnv) {
      args.push("-e", mcpExtension);
    }
BLOCK

cat > "$work/envLine.js" <<'BLOCK'
      env: childEnv ?? process.env,
BLOCK

# ── splice by ANCHOR ──

awk -v spawnHead="$work/spawnHead.js" -v envLine="$work/envLine.js" '
  BEGIN {
    while ((getline l < spawnHead) > 0) spawn_block = spawn_block l ORS
    while ((getline l < envLine) > 0) env_block = env_block l ORS
    bridge_check = "typeof process.env.PI_ACP_MCP_EXTENSION === \"string\" && process.env.PI_ACP_MCP_EXTENSION !== \"\""
  }
  # 1. the spawn(args) head: replace the args line with the wired block.
  /const args = \["--mode", "rpc", "--no-themes"\];/ {
    printf "%s", spawn_block
    next
  }
  # 1b. the env the child inherits: the wired one when armed.
  /^      env: process\.env,$/ {
    printf "%s", env_block
    next
  }
  # 2. session/new: the servers ride into the spawn.
  /^        cwd: params\.cwd,$/ {
    print
    print "        mcpServers: params.mcpServers,"
    next
  }
  # 3. session/load: same, from the request options.
  /^          cwd,$/ {
    print
    print "          mcpServers: opts?.mcpServers,"
    next
  }
  # 4. the advertised capabilities are the bridge arming, put in writing:
  # when the wrapper named no extension the adapter keeps answering false,
  # and `no` written in the capability is still a fact.
  /mcpCapabilities: \{ http: false, sse: false \},/ {
    print "        mcpCapabilities: { http: " bridge_check ", sse: " bridge_check " },"
    next
  }
  { print }
' "$work/original.js" > "$work/rebuilt.js"

# The upstream bundle ends WITHOUT a trailing newline and awk's `print`
# writes one every line: trim the byte back so the diff carries the four
# splices and nothing else.
if [ -z "$(tail -c1 "$work/original.js")" ]; then
  :  # ends in a newline — awk's print matches it exactly
else
  # The bundle ends WITHOUT a newline: awk wrote one for every print, so
  # drop the byte back off the rebuilt tail — the five splices must be the
  # whole diff, and a trailing-newline hunk is a sixth splice that lies.
  truncate -s -1 "$work/rebuilt.js"
fi

for marker in PI_ACP_MCP_SERVERS '"-e", mcpExtension' 'mcpServers: params.mcpServers' 'mcpServers: opts?.mcpServers' 'PI_ACP_MCP_EXTENSION !== ""'; do
  count="$(grep -c "$marker" "$work/rebuilt.js" || true)"
  if [[ "$count" -lt 1 ]]; then
    echo "anchor missed: '$marker' is not in the rebuild — the anchor moved; fix the script's anchors." >&2
    exit 1
  fi
done

diff -u --label a/dist/index.js --label b/dist/index.js \
  "$work/original.js" "$work/rebuilt.js" > "$out" || test $? -eq 1

# The build applies with `patch -p1 -d <package>`; check exactly that, on a
# pristine copy, rather than a git repo path the diff was never addressed to.
mkdir -p "$work/check/dist" && cp "$work/pkg/package/dist/index.js" "$work/check/dist/index.js"
(cd "$work/check" && patch -p1 -F0 --dry-run -d . < "$out" >/dev/null)
echo "$out regenerated (anchored splice, diff-computed hunks; $(grep -c '^+' "$out") additions)"
