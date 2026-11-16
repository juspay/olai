# The website, olai.page: the Astro build of `website/`, with every internal
# link and #anchor in the built pages checked.
#
# `$out` is the directory GitHub Pages publishes. The flake exposes it as the
# package `website`, which `just website` builds.
#
# The source is `website/`, each plugin's `docs.md` and the app's palette
# table. The pages under `website/docs/plugins/` are symlinks onto those
# `docs.md` files, so both ends must be in the store for a symlink to resolve.
# The plugin pages are named one directory at a time rather than found by a
# filter over `packages/plugins`, which would walk every plugin's
# `node_modules` in a checkout that has run `bun install`. The site's colours
# are read from `packages/appearance/src/palettes.ts`, which imports nothing.
{ pkgs, b2n }:
let
  inherit (pkgs) lib;
  plugins = ../packages/plugins;
  pluginPages = builtins.filter builtins.pathExists
    (map (name: plugins + "/${name}/docs.md")
      (builtins.attrNames (lib.filterAttrs (_: type: type == "directory") (builtins.readDir plugins))));
in
pkgs.stdenv.mkDerivation {
  pname = "olai-website";
  version = (lib.importJSON ../package.json).version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions ([
      ./package.json
      ./bun.lock
      ./bunfig.toml
      ./tsconfig.json
      ./astro.config.ts
      ./src
      ./public
      ./docs
      ../packages/appearance/src/palettes.ts
    ] ++ pluginPages);
  };

  bunRoot = "website";
  bunDeps = b2n.fetchBunDeps { bunNix = ./bun.nix; };
  nativeBuildInputs = [ b2n.hook pkgs.bun pkgs.nodejs pkgs.lychee ];

  # Astro asks before it phones home; a sandbox has nobody to ask.
  ASTRO_TELEMETRY_DISABLED = "1";
  # lychee builds its HTTP client at start even with --offline, and that client
  # refuses to start without CA roots.
  SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";

  dontFixup = true;

  buildPhase = ''
    runHook preBuild
    cd website
    # sharp, which Astro resizes pictures with, loads a prebuilt libvips that
    # needs the C++ runtime.
    LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib" bun run build
    runHook postBuild
  '';

  doCheck = true;
  checkPhase = ''
    runHook preCheck
    # The site's TypeScript: Astro's build strips types without checking them.
    bun run check
    # Offline: a link to another site is not fetched. An absolute link
    # (`/docs/chat/#signing-in`) resolves against the built site.
    lychee --offline --include-fragments --root-dir "$PWD/dist" \
      --index-files index.html --no-progress --format detailed 'dist/**/*.html'
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    cp -r dist $out
    runHook postInstall
  '';
}
