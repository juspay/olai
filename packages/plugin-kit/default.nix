# THE MECHANISM, SAID ONCE: the doors a plugin's `default.nix` can import and
# the root's fold validates against. No plugin is named here.
#
# Each plugin's `default.nix` (packages/plugins/<name>/default.nix) is a
# function `{ pkgs, pins, kit, b2n ? null }: { ... }` returning a contract
# attrset (see `packages/bundle/default.nix` and docs/architecture/plugin-system.md
# §10). `kit` IS this directory: the four mechanisms below, nothing else.
#
#   - `mark`      — a tenant's own logo, out of that tenant's pin, as a TS module.
#   - `npmAdapter`— one ACP adapter built from an npm shim (with its own lock).
#   - `contract`  — the validator: known keys, right types, `.generated.` infix,
#                   knob-vs-manifest equality. Every refusal names the plugin.
#   - `knobShell` — the `--set-default` / `--run` lines for `makeWrapper` and the
#                   equivalent `export VAR="${VAR-default}"` snippet for the dev
#                   loop, one function two renderings so they cannot drift.
#
# A plugin keeps its own derivations, lock, patches and generated files; this
# directory holds only what the root and every plugin read the same way.
{ pkgs }:
{
  mark = import ./nix/mark.nix { inherit pkgs; };
  npmAdapter = import ./nix/npm-adapter.nix { inherit pkgs; };
  contract = import ./nix/contract.nix;
  knobShell = import ./nix/knob-shell.nix { inherit pkgs; };
}
