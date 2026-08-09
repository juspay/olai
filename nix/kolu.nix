# The @kolu/* packages olai consumes — ONE list, everything else derived from
# it: the overlay attrs (`kolu-<name>`), the flake's `packages` output, the
# argv the hydrate script takes in the dev shell, and the same argv in the
# build derivation. Adding a package is one line.
#
# No vendoring: the sources live upstream in juspay/kolu and arrive through
# the npins pin (npins/sources.json). They are consumed as raw TypeScript —
# there is no build step.
let
  # @kolu/surface is the typed reactive layer the product is built on.
  # @kolu/log is the logger seam surface imports; a hydrated source resolves
  # its own imports from where it was copied, so its kolu siblings come too.
  names = [ "surface" "log" ];

  pairs = pkgs: builtins.concatMap
    (name: [ "${pkgs."kolu-${name}"}" "@kolu/${name}" ])
    names;
in
{
  inherit names;

  overlay = final: _prev: builtins.listToAttrs (map
    (name: {
      name = "kolu-${name}";
      value = final.runCommand "kolu-${name}"
        {
          meta = {
            description = "@kolu/${name} source extracted from juspay/kolu";
            homepage = "https://github.com/juspay/kolu";
          };
        }
        "cp -r ${(import ../npins).kolu}/packages/${name} $out";
    })
    names);

  # `sh scripts/hydrate-kolu-packages.sh $OLAI_KOLU_HYDRATE` — the script takes
  # <src> <dest> pairs, so the env carries the whole argv. One variable per
  # package would make every caller re-list the set.
  hydrateArgs = pkgs: builtins.concatStringsSep " " (pairs pkgs);

  # The same sources as bare directories, for scripts/check-kolu-deps.sh.
  sourceDirs = pkgs: builtins.concatStringsSep " "
    (map (name: "${pkgs."kolu-${name}"}") names);

  # Realizable store paths: `nix build .#kolu-surface` gets you the exact tree
  # the hydrate script copies.
  packages = pkgs: builtins.listToAttrs (map
    (name: { name = "kolu-${name}"; value = pkgs."kolu-${name}"; })
    names);
}
