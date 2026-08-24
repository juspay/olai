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
{ lib, stdenv, buildNpmPackage, makeWrapper, nodejs, patchelf, ripgrep, procps }:

buildNpmPackage {
  pname = "olai-acp-agent";
  version = "0.66.0"; # tracks @agentclientprotocol/claude-agent-acp

  # ../acp would also pull in whatever else lands in that directory; keep the
  # src (and its hash) to just the two files the build actually reads.
  src = lib.cleanSourceWith {
    name = "acp";
    src = ../acp;
    filter = path: _type:
      baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };
  npmDepsHash = "sha256-773leTH1zrV0X/VuCzU6ZRiIPzplzeh40BqIfTFauM0=";

  # acp/ is a shim around one dependency: nothing to compile, and no package in
  # the tree has an install script to run.
  dontNpmBuild = true;
  npmFlags = [ "--ignore-scripts" ];

  # See the header: the SDK ships `claude` as a bun-compiled executable, and
  # anything that moves its offsets breaks it.
  dontStrip = true;
  dontPatchELF = true;

  nativeBuildInputs = [ makeWrapper ]
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
      backgroundTasksPatch = ../acp/patches/background-tasks-visible.patch;
    in
    ''
      adapter="${mods}/@agentclientprotocol/claude-agent-acp"
      entry="$adapter/dist/index.js"
      test -f "$entry"
      # THE ONE PATCH THIS PIN CARRIES, and the whole reason it is applied here
      # rather than lived with: npm ships the adapter compiled, so what a
      # `patch -p1` reads is `dist/acp-agent.js` rather than the TypeScript it
      # was built from. `acp/patches/README.md` says what came from the
      # upstream PR and what olai added; a version bump makes this FAIL rather
      # than silently drop the behaviour, which is the auditable direction.
      patch -p1 -d "$adapter" < ${backgroundTasksPatch}
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
    '';

  # No meta.license on purpose: the adapter is Apache-2.0 but the `claude`
  # binary it drives ships under Anthropic's commercial terms, and declaring
  # that unfree would make `nix build` demand allowUnfree from every consumer of
  # this flake.
  meta = {
    description = "Claude Code ACP adapter, pinned for olai";
    homepage = "https://github.com/zed-industries/claude-code-acp";
    mainProgram = "claude-agent-acp";
    platforms = lib.platforms.unix;
  };
}
