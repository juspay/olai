# The ACP agent `olai serve` spawns. npm is the only channel the
# adapter ships through, so it gets the npins treatment: a committed
# lockfile in acp/, one fixed-output derivation (npmDepsHash) for the
# tarballs, nothing fetched at build time and no npx at run time.
# Regenerate after ANY edit to acp/package.json — the shim's own name is
# in the lockfile, so renaming it moves the hash as surely as a version
# bump does:
#   cd acp && npm install --package-lock-only --ignore-scripts
#   set npmDepsHash to lib.fakeHash, build, paste the hash it prints.
# The lockfile names a prebuilt `claude` for every platform npm knows
# about, so the deps FOD is ~640M and the hash is the same on every
# system; `npm ci` then keeps only the host's copy (~300M installed).
{ lib, stdenv, buildNpmPackage, makeWrapper, nodejs, patchelf, ripgrep, procps }:

buildNpmPackage {
  pname = "olai-acp-agent";
  version = "0.64.2"; # tracks @agentclientprotocol/claude-agent-acp
  # ./. would also pull in this default.nix; keep the src (and its hash)
  # to just the two files the build actually reads.
  src = lib.cleanSourceWith {
    name = "acp";
    src = ./.;
    filter = path: _type: baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };
  npmDepsHash = "sha256-fGYbBq7Z0FlRj0lH7fl9NYbmCcbVRJvW1RNDJ00ZIOs=";

  # acp/ is a shim around one dependency: nothing to compile, and no
  # package in the tree has an install script to run.
  dontNpmBuild = true;
  npmFlags = [ "--ignore-scripts" ];

  # The SDK ships `claude` as a bun-compiled executable. Both the
  # stripper and any RPATH rewrite move offsets the bun runtime reads
  # back out of its own file, and it segfaults; only the interpreter
  # may be touched (see postInstall).
  dontStrip = true;
  dontPatchELF = true;

  nativeBuildInputs = [ makeWrapper ]
    ++ lib.optional stdenv.hostPlatform.isLinux patchelf;

  postInstall =
    let
      # npm's own platform naming: linux-x64, darwin-arm64, ...
      nodeArch = "${stdenv.hostPlatform.node.platform}-${stdenv.hostPlatform.node.arch}";
      mods = "$out/lib/node_modules/olai-acp/node_modules";
    in
    ''
      entry="${mods}/@agentclientprotocol/claude-agent-acp/dist/index.js"
      test -f "$entry"
      claude="${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"
      test -x "$claude"
    '' + lib.optionalString stdenv.hostPlatform.isLinux ''
      patchelf --set-interpreter \
        "$(cat "${stdenv.cc}/nix-support/dynamic-linker")" "$claude"
    '' + ''
      # Node is pinned and so is the CLI the SDK drives (the adapter
      # reads CLAUDE_CODE_EXECUTABLE before it goes looking); nothing
      # here resolves off PATH. The rest of the env is what nixpkgs'
      # claude-code sets: no self-update (this closure is immutable),
      # and the ripgrep buried in the bun archive cannot be patched,
      # so hand it the one from the store.
      makeWrapper ${nodejs}/bin/node "$out/bin/claude-agent-acp" \
        --add-flags "$entry" \
        --set-default CLAUDE_CODE_EXECUTABLE "$claude" \
        --set DISABLE_AUTOUPDATER 1 \
        --set DISABLE_INSTALLATION_CHECKS 1 \
        --set USE_BUILTIN_RIPGREP 0 \
        --prefix PATH : "${lib.makeBinPath [ ripgrep procps ]}"
    '';

  # No meta.license on purpose: the adapter is Apache-2.0 but the
  # claude binary it drives ships under Anthropic's commercial terms,
  # and declaring that unfree would make `nix build` demand
  # allowUnfree from every consumer of this flake.
  meta = with lib; {
    description = "Claude Code ACP adapter, pinned for olai serve";
    mainProgram = "claude-agent-acp";
    platforms = platforms.unix;
  };
}
