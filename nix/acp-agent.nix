# The ACP agent `olai web` spawns.
#
# npm is the only channel the Claude Code adapter ships through, so it gets the
# same treatment every other pin here does: a committed lockfile in `acp/`, one
# fixed-output derivation for the tarballs, nothing fetched at build time and no
# `npx` at run time. A nix-built olai therefore needs nothing ambient — no PATH
# lookup, no version that drifts under you between two machines.
#
# Regenerate after ANY edit to acp/package.json — the shim's own name is in the
# lockfile, so renaming it moves the hash as surely as a version bump does:
#
#   cd acp && npm install --package-lock-only --ignore-scripts
#   set npmDepsHash to lib.fakeHash, build, paste the hash it prints.
#
# The lockfile names a prebuilt `claude` for every platform npm knows about, so
# the deps FOD is large and its hash is the same on every system; `npm ci` then
# keeps only the host's copy.
#
# Carried over from the racket reference's `acp/default.nix`, whose comments
# about the bun-compiled `claude` binary are the load-bearing part: both the
# stripper and an RPATH rewrite move offsets the bun runtime reads back out of
# its own file, and it segfaults. Only the interpreter may be touched.
{ lib, stdenv, buildNpmPackage, makeWrapper, nodejs, esbuild, patchelf, ripgrep, procps }:

buildNpmPackage {
  pname = "olai-acp-agent";
  # One lockfile, TWO adapters. The version names both pins rather than
  # claiming the build is the claude one alone: a bump of either line of
  # acp/package.json moves the store path's NAME, not only its hash — a
  # pi-acp bump that left the path stamped "0.66.0" would be the old claim
  # living on after its evidence.
  # tracks acp/package.json: @agentclientprotocol/claude-agent-acp + pi-acp
  version = "0.66.0+pi-0.0.33";

  # ../acp would also pull in whatever else lands in that directory; keep the
  # src (and its hash) to just the two files the build actually reads.
  src = lib.cleanSourceWith {
    name = "acp";
    src = ../acp;
    filter = path: _type:
      baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };
  npmDepsHash = "sha256-1iYPtmU9idX4KTzCHgiw7KILW31xWAPMrPjSDC1JaBA=";

  # acp/ is a shim around its two pinned dependencies: nothing to compile,
  # and no package in the tree has an install script to run.
  dontNpmBuild = true;
  npmFlags = [ "--ignore-scripts" ];

  # See the header: the SDK ships `claude` as a bun-compiled executable, and
  # anything that moves its offsets breaks it.
  dontStrip = true;
  dontPatchELF = true;

  nativeBuildInputs = [ makeWrapper esbuild ]
    ++ lib.optional stdenv.hostPlatform.isLinux patchelf;

  postInstall =
    let
      # npm's own platform naming: linux-x64, darwin-arm64, …
      nodeArch = "${stdenv.hostPlatform.node.platform}-${stdenv.hostPlatform.node.arch}";
      mods = "$out/lib/node_modules/olai-acp/node_modules";
      # A path of its own rather than a file in `src`: the src filter above
      # exists to keep the deps hash tied to the two files npm reads, and this
      # is read after npm has finished. Named here, so the derivation depends
      # on the patch's own hash and a change to it rebuilds the adapter.
      # Each of this pin's patches gets its own store path: interpolate the
      # PATH ITSELF rather than a string of them, so the derivation holds both
      # as sources — a list joined into one string reaches the builder as a
      # path it has no input for.
      backgroundTasksPatch = ../acp/patches/background-tasks-visible.patch;
      sessionListPatch = ../acp/patches/session-list-info.patch;
      piMcpServersPatch = ../acp/patches/pi-mcp-servers.patch;
      # THE OTHER HALF OF THAT PATCH: the extension pi loads and the
      # vocabulary module it shares with the pin's test rig. Installed one
      # directory up from the SDK and typebox inside the shim's tree so the
      # extension's relative-URL import rule answers — see its header —
      # rather than a bare specifier being left to whichever module
      # resolution pi's engine happens to run with.
      mcpBridgeDir = "${mods}/olai-pi-mcp-bridge";
    in
    ''
      adapter="${mods}/@agentclientprotocol/claude-agent-acp"
      entry="$adapter/dist/index.js"
      test -f "$entry"
      # THE PATCHES THIS PIN CARRIES, and the whole reason they are applied
      # here rather than lived with: npm ships the adapter compiled, so what a
      # `patch -p1` reads is `dist/acp-agent.js` rather than the TypeScript it
      # was built from. `acp/patches/README.md` says what each one is and
      # what olai added; a version bump makes this FAIL rather than silently
      # drop the behaviour, which is the auditable direction. `-F0` is the
      # audible half of that promise: `patch`'s default fuzz would land a
      # hunk up to two LINES from where the context said it belongs, which
      # is exactly the drift a re-anchor exists to catch — one reviewer had
      # it right and the other had it stated as a promise it was not yet.
      patch -p1 -F0 -d "$adapter" < ${backgroundTasksPatch}
      patch -p1 -F0 -d "$adapter" < ${sessionListPatch}
      # pi-acp's half of the carrying: the spawn hands each session's pi the
      # servers the ACP wire handed the session — acp/patches/README.md.
      # Same -F0 as the other two: each adapter's bump answers for the
      # drift its OWN hunks name.
      patch -p1 -F0 -d "${mods}/pi-acp" < ${piMcpServersPatch}
      mkdir -p "${mcpBridgeDir}"
      # Named WITHOUT the store's hash prefix: the extension and the
      # vocabulary import each other by name, and the -e arg's name later is
      # one a person can TYPE at an override layer. The SOURCE files stand
      # next to the bundle for the reviewer; what pi LOADS is the bundle:
      # pi loads extensions through jiti from inside a bun-compiled binary
      # whose package-resolution drops the knot of relative-URL discipline
      # (the bundled-embedded loader can't trace node_modules trees — a
      # pi-acp-spawned COPILOT village issue applies the multiplication),
      # so the bridge answers with ONE self-contained file.
      cp ${../acp/mcp-bridge/extension.mjs} "${mcpBridgeDir}/extension.mjs"
      cp ${../acp/mcp-bridge/naming.js} "${mcpBridgeDir}/naming.js"
      cp ${../acp/mcp-bridge/wire.mjs} "${mcpBridgeDir}/wire.mjs"
      ${esbuild}/bin/esbuild "${mcpBridgeDir}/extension.mjs" \
        --bundle --platform=node --format=esm --log-level=warning \
        --outfile="${mcpBridgeDir}/extension.bundle.mjs"
      claude="${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"
      test -x "$claude"
    '' + lib.optionalString stdenv.hostPlatform.isLinux ''
      patchelf --set-interpreter \
        "$(cat "${stdenv.cc}/nix-support/dynamic-linker")" "$claude"
    '' + ''
      # Node is pinned and so is the CLI the SDK drives (the adapter reads
      # CLAUDE_CODE_EXECUTABLE before it goes looking); nothing here resolves
      # off PATH. The rest of the env is what nixpkgs' claude-code sets: no
      # self-update (this closure is immutable), and the ripgrep buried in the
      # bun archive cannot be patched, so hand it the one from the store.
      makeWrapper ${nodejs}/bin/node "$out/bin/claude-agent-acp" \
        --add-flags "$entry" \
        --set-default CLAUDE_CODE_EXECUTABLE "$claude" \
        --set DISABLE_AUTOUPDATER 1 \
        --set DISABLE_INSTALLATION_CHECKS 1 \
        --set USE_BUILTIN_RIPGREP 0 \
        --prefix PATH : "${lib.makeBinPath [ ripgrep procps ]}"
      # THE SECOND SHIPPED ADAPTER: pi-acp, the bridge that spawns `pi --mode
      # rpc` for the pi leg. Pinned at the shim's revision like everything in
      # here — a floating `npx -y pi-acp` would be a different build every
      # day and the leg's facts are one revision's. No wrapper env of its
      # own: the `pi` IT drives is a per-machine find, so the roster names it
      # at spawn time (`PI_ACP_PI_COMMAND`) rather than it being baked.
      pi_entry="${mods}/pi-acp/dist/index.js"
      test -f "$pi_entry"
      # PI_ACP_MCP_EXTENSION is the ONE arming knob the patched adapter
      # reads: this wrapper sets it, so every documented way of starting
      # olai gets adapters whose `mcpCapabilities` answer http/sse TRUE in
      # fact, not the pin's README's say-so. An OLAI_ACP_PI override lane
      # that isn't this build answers its own flags — that is why the
      # capability read lives in the adapter's env, not in olai's roster.
      makeWrapper ${nodejs}/bin/node "$out/bin/pi-acp" \
        --add-flags "$pi_entry" \
        --set PI_ACP_MCP_EXTENSION "${mcpBridgeDir}/extension.bundle.mjs"
    '';

  # No meta.license on purpose: the adapter is Apache-2.0 but the `claude`
  # binary it drives ships under Anthropic's commercial terms, and declaring
  # that unfree would make `nix build` demand allowUnfree from every consumer of
  # this flake.
  meta = {
    description = "The ACP adapters olai ships: claude-code-acp and pi-acp, pinned together";
    homepage = "https://github.com/zed-industries/claude-code-acp";
    mainProgram = "claude-agent-acp";
    platforms = lib.platforms.unix;
  };
}
