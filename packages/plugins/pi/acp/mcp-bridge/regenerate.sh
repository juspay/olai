#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/../patches/pi-mcp-servers.patch"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

version="$(jq -r '.packages["node_modules/pi-acp"].version' "$here/../shim/package-lock.json")"
if [[ -z "$version" || "$version" == "null" ]]; then
  echo "no pin found in acp/shim/package-lock.json" >&2
  exit 1
fi
curl -sfSL "https://registry.npmjs.org/pi-acp/-/pi-acp-$version.tgz" -o "$work/pkg.tgz"
mkdir "$work/pkg"
tar -xzf "$work/pkg.tgz" -C "$work/pkg" package/dist/index.js
bundle="$work/pkg/package/dist/index.js"
echo "source bundle: pristine pi-acp $version"

cp "$bundle" "$work/original.js"

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

awk -v spawnHead="$work/spawnHead.js" -v envLine="$work/envLine.js" '
  BEGIN {
    while ((getline l < spawnHead) > 0) spawn_block = spawn_block l ORS
    while ((getline l < envLine) > 0) env_block = env_block l ORS
    bridge_check = "typeof process.env.PI_ACP_MCP_EXTENSION === \"string\" && process.env.PI_ACP_MCP_EXTENSION !== \"\""
  }
  /const args = \["--mode", "rpc", "--no-themes"\];/ {
    printf "%s", spawn_block
    next
  }
  /^      env: process\.env,$/ {
    printf "%s", env_block
    next
  }
  /^        cwd: params\.cwd,$/ {
    print
    print "        mcpServers: params.mcpServers,"
    next
  }
  /^          cwd,$/ {
    print
    print "          mcpServers: opts?.mcpServers,"
    next
  }
  /mcpCapabilities: \{ http: false, sse: false \},/ {
    print "        mcpCapabilities: { http: " bridge_check ", sse: " bridge_check " },"
    next
  }
  { print }
' "$work/original.js" > "$work/rebuilt.js"

# awk's `print` ends every line with a newline and the upstream bundle ends
# without one, so the byte it added comes back off.
if [ -n "$(tail -c1 "$work/original.js")" ]; then
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

mkdir -p "$work/check/dist" && cp "$work/pkg/package/dist/index.js" "$work/check/dist/index.js"
(cd "$work/check" && patch -p1 -F0 --dry-run -d . < "$out" >/dev/null)
echo "$out regenerated (anchored splice, diff-computed hunks; $(grep -c '^+' "$out") additions)"
