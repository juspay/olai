# IMPORTANT: this flake has ZERO inputs (the kolu convention). nixpkgs and
# the kolu source are pinned by npins (npins/sources.json) and imported via
# fetchTarball, which keeps `nix develop` cold eval near a second instead of
# the several the flake input system costs per input. Add a pin, not an input.
{
  description = "olai — outliner over flat-record JSONL";

  outputs = { self }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      eachSystem = f: builtins.listToAttrs (map
        (system: {
          name = system;
          value = f (import ./nix/nixpkgs.nix { inherit system; });
        })
        systems);
    in
    {
      devShells = eachSystem (pkgs: { default = import ./shell.nix { inherit pkgs; }; });

      # `nix build .#kolu-surface` realizes exactly the store path the dev
      # shell hands the hydrate script, so a broken pin fails here first.
      packages = eachSystem (pkgs: { inherit (pkgs) kolu-surface kolu-log; });

      formatter = eachSystem (pkgs: pkgs.nixpkgs-fmt);
    };
}
