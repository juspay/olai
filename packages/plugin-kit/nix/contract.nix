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
# THE TWO DOORS. `contract` is the strict door the registry fold composes from:
# it returns the validated contract and throws on every rule. `contractProblems`
# is the pure door — the same rules as a list of messages, never thrown — which
# the fold's `diagnostics` aggregation and `nix/fold-check.nix` read to assert a
# refusal names both sides without capturing a `throw` (Nix exposes no thrown
# message to the evaluator). One helper computes both; they cannot drift.
#
# The knob-vs-manifest equality reads package.json with `lib.importJSON`, so
# the manifest is the pin's own fact and there is no second copy to drift.
{ pkgs }:
let
  lib = pkgs.lib;

  # The contract attrset's known keys and every key's shape. Used BOTH as the
  # unknown-key list AND as the value-validation below, so the two lists can't
  # drift apart (a key added to one without the other is a contract with no
  # value check, or a check for a key the unknown-key rule then refuses).
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

  # `checkVals` forces lib.types checking for every declared key. A wrong
  # value-shape fails here (loud and by key) rather than drifting to a mis-set
  # wrapper.
  checkVals = contract:
    lib.evalModules {
      modules = [
        {
          options = lib.mapAttrs
            (k: t: lib.mkOption {
              type = t;
              # A plugin that names no contract key still gets a valid default
              # from this table: `{}` for the attrs, `[]` for the lists, a
              # no-op function for `checks`.
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

  # The pure door: EVERY rule as a list of refusal messages (or [ ] when the
  # contract is valid). The strict door throws one of these; fold-check.nix
  # reads the whole list for the both-sides assertions.
  problems = { name, dir, contract }:
    let
      unknown = builtins.filter (k: !builtins.hasAttr k keys) (builtins.attrNames contract);

      manifest = lib.importJSON "${dir}/package.json";
      # The manifest records each knob as `name -> { kind }`; normalize to the
      # kind STRING so the comparisons below are against one shape.
      manifestKnobs = lib.mapAttrs (_: v: v.kind) (manifest.olai.knobs or { });
      declared = contract.knobs or { };

      nixOnly = lib.filter (k: !builtins.hasAttr k manifestKnobs) (builtins.attrNames declared);
      manifestOnly = lib.filter (k: !builtins.hasAttr k declared) (builtins.attrNames manifestKnobs);
      # A kind clash can only be named when BOTH sides supply the knob.
      bothNamed = lib.intersectLists (builtins.attrNames declared) (builtins.attrNames manifestKnobs);
      kindMismatch = lib.filter (k: manifestKnobs.${k} != (declared.${k}).kind) bothNamed;
      badKind = lib.filter
        (k: !builtins.elem (declared.${k}).kind [ "file" "dir" ])
        (builtins.attrNames declared);
      badGenerated = lib.filter
        (p: builtins.match ".*\\.generated\\..*" p == null)
        (builtins.attrNames (contract.generated or { }));
    in
    # Each rule is one refusal naming the plugin, in the order the contract
      # means its words: unknown keys, the two-spellings knob rules, then the
      # generated-path infix.
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
  # The strict door: the validated contract, or every problem thrown at once,
  # each naming the plugin.
  contract = { name, dir, contract }:
    let
      ps = problems { inherit name dir contract; };
      check = checkVals contract;
    in
    if ps != [ ] then
      throw ("plugin ${name}: " + builtins.concatStringsSep "; " ps)
    else
      check.config;

  # The pure door: the whole list of problem messages, or [ ]. `check` is
  # still forced so a value-shape error (a wrong `holds` kind, a `kind` that is
  # neither `file` nor `dir`, …) surfaces here instead of silently passing the
  # pure door and only exploding (or worse, not exploding) in the strict door.
  contractProblems = { name, dir, contract }:
    let
      ps = problems { inherit name dir contract; };
      check = checkVals contract;
    in
    # Run the type-checking machinery on a CLEAN contract — the `check` was
    # computed but never forced, so option declarations undetected otherwise.
    # Deliberately NOT realizing the evalModules `config`: on a BROKEN
    # contract it throws "option does not exist" before `problems` can report
    # the unknown key as a diagnostic, and on the shell path it realizes a
    # knob's operational `path` (odu's `"${bin}/bin"` with `b2n == null`).
    # So `ps` gates it — a broken contract returns its refusals as-is
    # (fold-check / `diagnostics` read that list, never a `throw`), and only a
    # valid one has the declared-type tree driven (which surfaces declaration
    # / structural errors without touching values). VALUE shape errors inside
    # an option surface from the strict `contract` door when the root composes
    # the value, where `b2n` is real and realization is expected.
    if ps == [ ] then
      lib.seq check.options ps
    else
      ps;
}
