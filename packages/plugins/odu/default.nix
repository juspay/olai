# `b2n` must be a real `bun2nix` package (the CLI derivation with `hook` and
# `fetchBunDeps` on passthru).

{ pkgs, pins, kit, b2n ? null, ... }:

let
  src = pins.odu;

  bin =
    if b2n == null then
      throw "odu plugin: b2n is null — this plugin builds only in the flake, not the dev shell"
    else
      (import "${src}/default.nix" {
        pkgs = import "${src}/nix/nixpkgs.nix" {
          inherit (pkgs.stdenv.hostPlatform) system;
        };
        inherit b2n;
        selfFlake = "${src}";
      }).odu;
  mark = kit.mark {
    svg = "${src}/logo.svg";
    revision = src.revision;
    from = "juspay/odu logo.svg";
  };
in
{
  hydrate =
    let
      pair = dir: name: { src = "${src}/packages/${dir}"; dest = name; };
    in
    [
      (pair "run-client" "@odu/run-client")
      (pair "run-history" "@odu/run-history")
      (pair "service-client" "@odu/service-client")
    ];

  externals =
    let
      manifestOf = dir:
        builtins.fromJSON
          (builtins.readFile "${src}/packages/${dir}/package.json");
      npmOf = dir:
        let
          deps = (manifestOf dir).dependencies or { };
          names = builtins.filter (n: builtins.match "@odu/.*" n == null)
            (builtins.attrNames deps);
        in
        builtins.listToAttrs
          (map (n: { name = n; value = deps.${n}; }) names);
    in
    (npmOf "run-client") // (npmOf "run-history") // (npmOf "service-client");

  generated."src/browser/mark.generated.ts" = mark;
  knobs.OLAI_ODU_BIN = {
    kind = "dir";
    path = "${bin}/bin";
    holds = "odu";
  };
  checks = { tree }:
    if b2n == null then { } else {
      surface = pkgs.runCommand "olai-plugin-odu-surface"
        {
          nativeBuildInputs = [ pkgs.bun ];
          src = tree;
          server = bin;
        } ''
        export HOME=$TMPDIR
        cd $src
        OLAI_ODU_BIN=$server/bin \
          bun packages/plugins/odu/src/surface.check.ts $server/bin
        mkdir -p $out
        echo "$server/bin" > $out/ok
      '';
    };
  packages = {
    odu = bin;
    odu-bin = bin;
    odu-mark = mark;
  };
}
