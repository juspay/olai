{ pkgs, pins, kit, b2n ? null, ... }:
let
  npins = pins;
  himalaya = import "${npins.himalaya}/default.nix" {
    nixpkgs = "${npins.nixpkgs}";
    inherit pkgs;
    system = pkgs.stdenv.hostPlatform.system;
    pimalaya = import "${npins.pimalaya}";
    fenix = import "${npins.fenix}" {
      inherit pkgs;
      system = pkgs.stdenv.hostPlatform.system;
    };
  };
in
{
  knobs.OLAI_HIMALAYA = {
    kind = "file";
    path = "${himalaya}/bin/himalaya";
  };
  packages.himalaya-bin = himalaya;
  checks = { tree }: {
    surface = pkgs.runCommand "olai-plugin-mail-surface"
      {
        nativeBuildInputs = [ pkgs.bun ];
        src = tree;
        server = himalaya;
      } ''
      export HOME=$TMPDIR
      cd $src
      OLAI_HIMALAYA=$server/bin/himalaya \
        bun packages/plugins/mail/src/himalaya/surface.check.ts $server/bin
      mkdir -p $out
      echo "$server/bin/himalaya" > $out/ok
    '';
  };
}
