# The ACP adapters `olai web` spawns — one derivation, PARAMETERISED BY THE ROW.
#
# npm is the only channel either adapter ships through, so both get the same
# treatment every other pin here does: a committed lockfile in `acp/`, one
# fixed-output derivation for the tarballs, nothing fetched at build time and no
# `npx` at run time. A nix-built olai therefore needs nothing ambient — no PATH
# lookup, no version that drifts under you between two machines.
#
# ## What the agents phase changed, and what it deliberately did not
#
# An ENGINE IS A PLUGIN now — `packages/plugins/claude/`, `opencode/`, `pi/`,
# one row each in `olai.yml` — and this file follows that: the per-adapter work
# is a LIST OF ROWS (`engines` below), each naming its package inside the
# installed tree, the patches it carries, whatever else it needs installed
# beside it, and the wrapper it produces. Adding a fourth shipped adapter is a
# row here and a directory there; nothing in the body below learns its name.
#
# **The PATCHES moved with their engine.** They are
# `packages/plugins/claude/acp/patches/` and `packages/plugins/pi/acp/patches/`
# now, beside the sources they are generated from, because an adapter's patch
# set moves on that adapter's own release clock — this one's pin moved five
# times in a month and the other's has not moved at all. This file names no
# patch: it READS each engine's own directory (`patchesFor` below), so adding
# one is a file in the plugin and nothing here. Each is still a PATH, so the
# derivation depends on the patch's own hash and a change to it rebuilds the
# adapter.
#
# **The npm SHIM did not.** `acp/package.json` and its lockfile stay one file
# with two dependencies in it, and that is a decision rather than a leftover:
# one lockfile is ONE fixed-output derivation and one `npmDepsHash`, and
# splitting it would buy nothing this phase asks for while costing two large
# FODs and two hashes to keep in step. `acp/README.md` argues it where a person
# looking for the pin will land.
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
  # pi-acp bump that left the path stamped "0.73.0" would be the old claim
  # living on after its evidence.
  # tracks acp/package.json: @agentclientprotocol/claude-agent-acp + pi-acp
  version = "0.73.0+pi-0.0.33";

  # ../acp would also pull in whatever else lands in that directory; keep the
  # src (and its hash) to just the two files the build actually reads. The
  # patches are NOT in there and never were — they are read from each plugin's
  # own directory below, so each gets its own store input.
  src = lib.cleanSourceWith {
    name = "acp";
    src = ../acp;
    filter = path: _type:
      baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };
  npmDepsHash = "sha256-dCiEbsKRiCWle/OFr1qypIZQ7lrGhxStLli3zlck+GY=";

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

      # THE OTHER HALF OF PI'S PATCH: the extension pi loads and the vocabulary
      # module it shares with the pin's test rig. Installed one directory up
      # from the SDK and typebox inside the shim's tree so the extension's
      # relative-URL import rule answers — see its header — rather than a bare
      # specifier being left to whichever module resolution pi's engine happens
      # to run with.
      #
      # Named WITHOUT the store's hash prefix: the extension and the vocabulary
      # import each other by name, and the -e arg's name later is one a person
      # can TYPE at an override layer. The SOURCE files stand next to the bundle
      # for the reviewer; what pi LOADS is the bundle: pi loads extensions
      # through jiti from inside a bun-compiled binary whose package-resolution
      # drops the knot of relative-URL discipline (the bundled-embedded loader
      # can't trace node_modules trees), so the bridge answers with ONE
      # self-contained file.
      mcpBridgeDir = "${mods}/olai-pi-mcp-bridge";
      bridge = ../packages/plugins/pi/acp/mcp-bridge;

      # EVERY `.patch` IN THAT PLUGIN'S OWN DIRECTORY, in name order — read
      # rather than listed.
      #
      # The rows below used to name each patch file by path, which meant adding
      # one was two edits in two directories: the file, and a line here. The
      # patches moved into the plugin the day the engines became plugins, and
      # naming them a second time from outside kept exactly the coupling that
      # move was for. Now a patch is ONE FILE in `packages/plugins/<name>/acp/
      # patches/`, and this picks it up.
      #
      # SORTED, because the order patches apply in is a fact somebody depends on
      # the moment two of them touch one file, and `readDir` has no order worth
      # relying on. `builtins.sort` over the names gives the same sequence on
      # every machine and every eval; a patch that must land after another is
      # named to sort after it, which is the same discipline a migrations
      # directory keeps.
      #
      # A DIRECTORY THAT IS NOT THERE is an engine with no patches — `opencode`
      # ships nothing, being found on the PATH rather than pinned — so the
      # absence answers the empty list rather than failing the eval.
      patchesFor = plugin:
        let dir = ../packages/plugins + "/${plugin}/acp/patches";
        in
        if !builtins.pathExists dir then [ ]
        else
          map (name: dir + "/${name}")
            (builtins.sort (a: b: a < b)
              (builtins.attrNames
                (lib.filterAttrs (name: kind: kind == "regular" && lib.hasSuffix ".patch" name)
                  (builtins.readDir dir))));

      # ONE ROW PER SHIPPED ADAPTER — the same shape `olai.yml` gives a plugin,
      # one wall down. `plugin` names the directory its patches are read from
      # and is what a failure prints; `package` is where npm put it; `entry` is
      # the file the wrapper runs; `bin` is the wrapper's name, which is what
      # `scripts/acp-*.sh` prints and what `default.nix` bakes into
      # `OLAI_ACP_AGENT` / `OLAI_ACP_PI`; `env` is whatever that wrapper must
      # set. Nothing here spells a patch: that is the plugin's directory.
      engines = [
        {
          plugin = "claude";
          package = "@agentclientprotocol/claude-agent-acp";
          entry = "dist/index.js";
          bin = "claude-agent-acp";
          # Node is pinned and so is the CLI the SDK drives (the adapter reads
          # CLAUDE_CODE_EXECUTABLE before it goes looking); nothing here
          # resolves off PATH. The rest is what the packaged claude-code sets: no
          # self-update (this closure is immutable), and the ripgrep buried in
          # the bun archive cannot be patched, so hand it the one from the
          # store.
          env = [
            ''--set-default CLAUDE_CODE_EXECUTABLE "${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"''
            "--set DISABLE_AUTOUPDATER 1"
            "--set DISABLE_INSTALLATION_CHECKS 1"
            "--set USE_BUILTIN_RIPGREP 0"
            ''--prefix PATH : "${lib.makeBinPath [ ripgrep procps ]}"''
          ];
        }
        {
          plugin = "pi";
          package = "pi-acp";
          entry = "dist/index.js";
          bin = "pi-acp";
          # PI_ACP_MCP_EXTENSION is the ONE arming knob the patched adapter
          # reads: this wrapper sets it, so every documented way of starting
          # olai gets an adapter whose `mcpCapabilities` answer http/sse TRUE in
          # fact, not the pin's README's say-so. An OLAI_ACP_PI override lane
          # that isn't this build answers its own flags — that is why the
          # capability read lives in the adapter's env, not in olai's roster.
          #
          # No `pi` baked in: the agent it drives is a per-machine find, so the
          # ROW names it at spawn time (`PI_ACP_PI_COMMAND`, set by
          # `olai-plugin-pi`'s probe) rather than it being fixed here.
          env = [ ''--set PI_ACP_MCP_EXTENSION "${mcpBridgeDir}/extension.bundle.mjs"'' ];
        }
      ];

      # ONE ENGINE'S WHOLE INSTALL — patch it, then wrap it.
      #
      # `patch -p1 -F0` is the audible promise this whole arrangement rests on:
      # npm ships each adapter COMPILED, so what a `patch -p1` reads is the
      # bundle rather than the TypeScript it was built from, and a version bump
      # must FAIL rather than silently drop the behaviour. `-F0` is the audible
      # half — patch's default fuzz would land a hunk up to two LINES from where
      # its context said it belongs, which is exactly the drift a re-anchor
      # exists to catch. Each engine's `patches/README.md` says what each one is
      # and what olai added.
      install = engine: ''
        adapter="${mods}/${engine.package}"
        entry="$adapter/${engine.entry}"
        test -f "$entry"
        ${lib.concatMapStringsSep "\n" (patch: ''patch -p1 -F0 -d "$adapter" < ${patch}'') (patchesFor engine.plugin)}
        makeWrapper ${nodejs}/bin/node "$out/bin/${engine.bin}" \
          --add-flags "$entry" \
          ${lib.concatStringsSep " \\\n          " engine.env}
      '';
    in
    ''
      # THE PI BRIDGE, installed before the row that arms it — its own half of
      # `pi-mcp-servers.patch`, which is why it is here rather than in a row's
      # `patches` list: a patch is a diff and this is a file the patched code
      # goes looking for.
      mkdir -p "${mcpBridgeDir}"
      cp ${bridge}/extension.mjs "${mcpBridgeDir}/extension.mjs"
      cp ${bridge}/naming.js "${mcpBridgeDir}/naming.js"
      cp ${bridge}/wire.mjs "${mcpBridgeDir}/wire.mjs"
      ${esbuild}/bin/esbuild "${mcpBridgeDir}/extension.mjs" \
        --bundle --platform=node --format=esm --log-level=warning \
        --outfile="${mcpBridgeDir}/extension.bundle.mjs"

      claude="${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"
      test -x "$claude"
    '' + lib.optionalString stdenv.hostPlatform.isLinux ''
      patchelf --set-interpreter \
        "$(cat "${stdenv.cc}/nix-support/dynamic-linker")" "$claude"
    '' + lib.concatMapStringsSep "\n" install engines;

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
