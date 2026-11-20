# Nix exposes no thrown message to the evaluator, so `nix/fold-check.nix` and
# the fold's `diagnostics` cannot read a `throw`: the same rules are computed
# once and offered as a throwing door and a message-list door.
{ pkgs }:
let
  lib = pkgs.lib;

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

  checkVals = contract:
    lib.evalModules {
      modules = [
        {
          options = lib.mapAttrs
            (k: t: lib.mkOption {
              type = t;
              default = {
                hydrate = [ ];
                externals = { };
                koluSeeds = [ ];
                koluPins = { };
                generated = { };
                npmTrees = [ ];
                knobs = { };
                packages = { };
                checks = (_: { });
              }.${k};
            })
            keys;
          config = lib.filterAttrs (_: v: true) contract;
        }
      ];
    };

  problems = { name, dir, contract }:
    let
      unknown = builtins.filter (k: !builtins.hasAttr k keys) (builtins.attrNames contract);

      manifest = lib.importJSON "${dir}/package.json";
      manifestKnobs = lib.mapAttrs (_: v: v.kind) (manifest.olai.knobs or { });
      declared = contract.knobs or { };

      nixOnly = lib.filter (k: !builtins.hasAttr k manifestKnobs) (builtins.attrNames declared);
      manifestOnly = lib.filter (k: !builtins.hasAttr k declared) (builtins.attrNames manifestKnobs);
      bothNamed = lib.intersectLists (builtins.attrNames declared) (builtins.attrNames manifestKnobs);
      kindMismatch = lib.filter (k: manifestKnobs.${k} != (declared.${k}).kind) bothNamed;
      badKind = lib.filter
        (k: !builtins.elem (declared.${k}).kind [ "file" "dir" ])
        (builtins.attrNames declared);
      badGenerated = lib.filter
        (p: builtins.match ".*\\.generated\\..*" p == null)
        (builtins.attrNames (contract.generated or { }));
    in
    (if unknown != [ ] then
      [ "unknown contract ${toString unknown} — a plugin's default.nix may name only: ${toString (builtins.attrNames keys)}" ]
    else [ ])
    ++ (if nixOnly != [ ] then
      [ "knobs ${toString nixOnly} are supplied by default.nix but absent from package.json's olai.knobs — the wrapper would bake a default the settings panel cannot answer" ]
    else [ ])
    ++ (if manifestOnly != [ ] then
      [ "knobs ${toString manifestOnly} are declared in package.json's olai.knobs but absent from default.nix — the settings panel would promise a row the wrapper never bakes" ]
    else [ ])
    ++ (if badKind != [ ] then
      [
        "a knob's kind must be `file` or `dir`"
      ]
    else [ ])
    ++ (if kindMismatch != [ ] then
      map (k: "knob `${k}` has kind `${(declared.${k}).kind}` in default.nix but `${manifestKnobs.${k}}` in package.json's olai.knobs — one kind, held equal") kindMismatch
    else [ ])
    ++ (if badGenerated != [ ] then
      map (p: "generated path `${p}` lacks the `.generated.` infix — the root's gitignore glob and the fold's install both rely on it") badGenerated
    else [ ]);

in
{
  contract = { name, dir, contract }:
    let
      ps = problems { inherit name dir contract; };
      check = checkVals contract;
    in
    if ps != [ ] then
      throw ("plugin ${name}: " + builtins.concatStringsSep "; " ps)
    else
      check.config;

  contractProblems = { name, dir, contract }:
    let
      ps = problems { inherit name dir contract; };
      check = checkVals contract;
    in
    if ps == [ ] then
      lib.seq check.options ps
    else
      ps;
}
