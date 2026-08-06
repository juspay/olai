# The e2e harness's node_modules, as a derivation.
#
# npm is the only channel cucumber and playwright ship through, so they get
# the acp/ treatment: a committed lockfile, ONE fixed-output derivation
# (fetchNpmDeps) for the tarballs, nothing fetched when the tree is built.
# Regenerate after any edit to e2e/package.json:
#   cd e2e && npm install --package-lock-only --ignore-scripts
#   set npmDeps.hash below to lib.fakeHash, build, paste what nix prints.
#
# It is node_modules and nothing else — not an installed package. ESM
# resolution walks UP from the importing file and ignores NODE_PATH, so the
# harness needs this tree at e2e/node_modules; `just e2e` symlinks it there.
#
# --ignore-scripts is load-bearing twice over: playwright's postinstall
# downloads a browser, and the browser is nixpkgs' (playwright-driver, pinned
# to the same version in flake.nix).
{ lib, stdenvNoCC, nodejs, npmHooks, fetchNpmDeps }:

stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "olai-e2e-node-modules";
  version = "0.1.0";

  # ./. would pull in the features and steps, and every edit to a scenario
  # would rebuild the deps. Keep src to what npm actually reads.
  src = lib.cleanSourceWith {
    name = "olai-e2e-manifest";
    src = ./.;
    filter = path: _type:
      builtins.elem (baseNameOf path) [ "package.json" "package-lock.json" ];
  };

  npmDeps = fetchNpmDeps {
    inherit (finalAttrs) src;
    name = "${finalAttrs.pname}-${finalAttrs.version}-npm-deps";
    hash = "sha256-W7xMppL4qlYhjg19rZB0eDoJkOhgpNKzV9IjzKIGFus=";
  };

  nativeBuildInputs = [ nodejs npmHooks.npmConfigHook ];
  npmFlags = [ "--ignore-scripts" ];

  dontBuild = true;

  # -a, not -r: .bin/cucumber-js is a relative symlink into the tree, and a
  # copy that followed it would leave a file no `npm` ever wrote.
  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -a node_modules $out/node_modules
    runHook postInstall
  '';

  meta = {
    description = "cucumber + playwright, pinned, for olai's browser journeys";
    platforms = lib.platforms.unix;
  };
})
