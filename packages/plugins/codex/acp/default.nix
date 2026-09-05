# The Codex plugin's complete executable side: one npm pin, the native Codex
# binary that pin resolves, and the ACP wrapper olai spawns. It lives with the
# plugin because neither its release clock nor its platform layout is shared by
# the patched Claude/Pi adapter bundle in nix/acp-agent.nix.
{ lib, stdenv, buildNpmPackage, fetchFromGitHub, makeWrapper, nodejs }:

let
  adapterVersion = "1.10.0";
  codexVersion = "0.153.3"; # resolved by this adapter release's package-lock
  # The optional npm package and the native binary inside it use different
  # platform vocabularies. One table keeps the pair atomic and makes an
  # unsupported host fail at evaluation rather than fall into a Darwin branch.
  codexPlatforms = {
    "x86_64-linux" = { npm = "linux-x64"; target = "x86_64-unknown-linux-musl"; };
    "aarch64-linux" = { npm = "linux-arm64"; target = "aarch64-unknown-linux-musl"; };
    "x86_64-darwin" = { npm = "darwin-x64"; target = "x86_64-apple-darwin"; };
    "aarch64-darwin" = { npm = "darwin-arm64"; target = "aarch64-apple-darwin"; };
  };
  platform = codexPlatforms.${stdenv.hostPlatform.system};
in
buildNpmPackage {
  pname = "olai-codex-agent";
  version = "${adapterVersion}+codex-${codexVersion}";

  src = fetchFromGitHub {
    owner = "agentclientprotocol";
    repo = "codex-acp";
    rev = "v${adapterVersion}";
    hash = "sha256-D8uYd30NRXQYUSBFCi66Oq0iRZXpl8P7nWv2m3+KBig=";
  };
  npmDepsHash = "sha256-df1/kPiZFBEq9Um26Qbo9XaYj2J8BOXQmunCQWquDTo=";

  nativeBuildInputs = [ makeWrapper ];

  postInstall =
    let
      package = "$out/lib/node_modules/@agentclientprotocol/codex-acp";
      mods = "${package}/node_modules";
      adapter = "${package}/dist/index.js";
      codex = "${mods}/@openai/codex-${platform.npm}/vendor/${platform.target}/bin/codex";
    in
    ''
      test -f "${adapter}"
      test -x "${codex}"
      makeWrapper ${nodejs}/bin/node "$out/bin/codex-acp" \
        --add-flags "${adapter}" \
        --set-default CODEX_PATH "${codex}"
    '';

  meta = {
    description = "The Codex ACP adapter and Codex CLI olai ships";
    homepage = "https://github.com/agentclientprotocol/codex-acp";
    mainProgram = "codex-acp";
    platforms = builtins.attrNames codexPlatforms;
  };
}
