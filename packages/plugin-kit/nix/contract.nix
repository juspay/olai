# THE CONTRACT VALIDATOR — one place that knows what a plugin's `default.nix`
# may return, and every refusal names the plugin.
#
# A plugin's `default.nix` (packages/plugins/<name>/default.nix), when present,
# is `{ pkgs, pins, kit, b2n ? null }: { ... }`. It returns an attrset whose
# every key is optional and drawn from this list; ANY other key is refused
# (loud absence). The two generated-path and knob rules hold the contract's
# own silence against the manifest (package.json), so a plugin that declares
# a knob the manifest does not, or the reverse, fails eval by name rather
# than shipping a wrapper and a settings panel that disagree.
#
# The knob-vs-manifest equality reads package.json with `lib.importJSON`, so
# the manifest is the pin's own fact and there is no second copy to drift.
{ lib, name, dir, contract }:
let
  fail = msg: throw "plugin ${name}: ${msg}";

  keys = {
    hydrate = lib.types.listOf (lib.types.submodule {
      options.src = lib.mkOption { type = lib.types.str; };
      options.dest = lib.mkOption { type = lib.types.str; };
    });
    externals = lib.types.attrsOf lib.types.str;
    koluSeeds = lib.types.listOf lib.types.str;
    koluPins = lib.types.attrsOf (lib.types.submodule {
      options.src = lib.mkOption { type = lib.types.str; };
      options.revision = lib.mkOption { type = lib.types.str; };
    });
    generated = lib.types.attrsOf lib.types.package;
    npmTrees = lib.types.listOf lib.types.str;
    knobs = lib.types.attrsOf (lib.types.submodule {
      options.kind = lib.mkOption { type = lib.types.enum [ "file" "dir" ]; };
      options.path = lib.mkOption { type = lib.types.str; };
      options.holds = lib.mkOption { type = lib.types.nullOr lib.types.str; };
    });
    packages = lib.types.attrsOf lib.types.package;
    checks = lib.types.functionTo (lib.types.attrsOf lib.types.package);
  };

  # An unknown key is a typo, and a typo that would otherwise be silent.
  bad = lib.filter (k: !builtins.hasAttr k keys) (builtins.attrNames contract);
in
if bad != [ ] then
  fail "unknown contract ${toString bad} — a plugin's default.nix may name only: ${toString (builtins.attrNames keys)}"
else
  let
    # `generated` names plugin-relative paths whose every one must carry the
    # `.generated.` infix. The fold prefixes the plugin's directory and the
    # `.gitignore` glob (`/packages/plugins/**/*.generated.ts`) is total only
    # because this infix is compulsory — a path without it would be a committed
    # file the fold overwrites, or a generated file nobody ignores.
    checkGenerated = path:
      if builtins.match ".*\\.generated\\..*" path == null then
        fail "generated path `${path}` lacks the `.generated.` infix — the root's gitignore glob and the fold's install both rely on it"
      else true;

    manifest = lib.importJSON "${dir}/package.json";
    manifestKnobs = manifest.olai.knobs or { };
    declared = contract.knobs or { };

    # Every knob nix supplies must be in the manifest's `olai.knobs`, and the
    # reverse: a knob the wrapper bakes that the settings panel does not know,
    # or a knob the manifest promises that nix never sets, is the two-spellings
    # bug the contract exists to make impossible.
    nixOnly = lib.filter (k: !builtins.hasAttr k manifestKnobs) (builtins.attrNames declared);
    manifestOnly = lib.filter (k: !builtins.hasAttr k declared) (builtins.attrNames manifestKnobs);
  in
  if nixOnly != [ ] then
    fail "knobs ${toString nixOnly} are supplied by default.nix but absent from package.json's olai.knobs"
  else if manifestOnly != [ ] then
    fail "knobs ${toString manifestOnly} are declared in package.json's olai.knobs but absent from default.nix"
  else if builtins.any (k: (declared.${k}).kind != "file" && (declared.${k}).kind != "dir") (builtins.attrNames declared) then
    fail "a knob's kind must be `file` or `dir`"
  else
    let
      # Force the `.generated.` rule for every path so the throw lands here, at
      # fold time, rather than later under an opaque eval. `generated` itself is
      # `attrsOf package`, unchanged.
      checked = lib.optionalAttrs (builtins.hasAttr "generated" contract)
        {
          generated = builtins.seq
            (builtins.map (p: builtins.seq (checkGenerated p) null) (builtins.attrNames contract.generated))
            contract.generated;
        };
    in
    contract // checked
