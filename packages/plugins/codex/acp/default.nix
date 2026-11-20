{ lib, stdenv, buildNpmPackage, fetchFromGitHub, fetchpatch, makeWrapper, nodejs }:

let
  adapterVersion = "1.13.1";
  codexVersion = "0.156.1";
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
    hash = "sha256-lVsj8RqE8XwCblOBSk3B4Nckx4h1o1BHMRrmpkhrIEw=";
  };
  npmDepsHash = "sha256-jXXvfg2bPZlvkNBZUw3ptpoOy9wOcvl2B8J0HnpX79c=";

  patches = [
    (fetchpatch {
      name = "codex-steering-idle-fallback.patch";
      url = "https://github.com/agentclientprotocol/codex-acp/commit/84bfbe8318400b139214e9aa51352585aae19368.patch";
      hash = "sha256-C8lIfgcbXXifUdrdvv29eMJMKAC7uyvHuBYtqGbcScM=";
    })
  ];
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    cp ${./permission-mode.test.ts.in} src/__tests__/CodexACPAgent/olai-permission-mode.test.ts
    ./node_modules/.bin/vitest run src/__tests__/CodexACPAgent/steer-events.test.ts src/__tests__/CodexACPAgent/olai-permission-mode.test.ts
    runHook postCheck
  '';

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
