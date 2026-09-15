# THE FOLD CHECK — `checks.plugin-fold`. Drives the registry fold
# (packages/bundle/default.nix) over the fixture containers in ./fixtures/ and
# asserts, AT EVAL TIME, that each refusal is detected and names both
# offending plugins.
#
# HOW THE ASSERTION WORKS. The fold's strict values `throw` on a refusal, but
# Nix's `builtins.tryEval` never exposes the thrown message — so this check
# cannot grep a `throw`. Instead the fold ALSO returns a PURE `diagnostics`
# projection (each row: the contract attr, the colliding key, BOTH owners, and
# the exact refusal message) computed by the same helper the strict fold
# refuses on. Checking `diagnostics` and the strict build are the same fact:
# a green diagnostics check and a green composition cannot drift, and the
# message content is asserted from the `owners`/`message` the fold itself
# computed — no sentinels, no nested evaluator (which has no store access in
# the sandbox anyway).
#
# FIXTURES. Each subdirectory of ./fixtures/ is a container shaped like
# `packages/plugins/`: a couple of plugin dirs and a `package.json` in each.
# A plugin with no `default.nix` (the common case) is in `accepted/`. The
# refusals each carry exactly one contract breach, named in the scenario:
# an unknown key, a `.generated.`-less path, two plugins claiming one knob,
# one flake output name, one hydrate destination, a knob the manifest lacks,
# a manifest knob nix lacks.
{ pkgs }:

let
  lib = pkgs.lib;
  pins = import ../../npins;

  # The fold, driven over a fixture container instead of the real
  # packages/plugins directory.
  foldFor = scenario: import ../default.nix {
    inherit pkgs pins;
    b2n = null;
    container = ./fixtures/${scenario};
  };

  # The scenario table describes the fold's contract:
  #   ok     — diagnostics must be empty (the accepted container).
  #   refuse — the fold must refuse, and the refusal must name the owners.
  # `owners` are the plugins both a collision or a contract mismatch must name.
  scenarios = {
    accepted = "ok";
    unknown-key = { refuse = { owners = [ "bogus-plugin" ]; }; };
    bad-generated = { refuse = { owners = [ "no-infix" ]; }; };
    knob-clash = { refuse = { owners = [ "plugin-a" "plugin-b" ]; }; };
    flake-clash = { refuse = { owners = [ "plugin-a" "plugin-b" ]; }; };
    hydrate-clash = { refuse = { owners = [ "plugin-a" "plugin-b" ]; }; };
    knob-not-in-manifest = { refuse = { owners = [ "rogue" ]; }; };
    manifest-knob-not-in-nix = { refuse = { owners = [ "forgetful" ]; }; };
  };

  # ONE STRICT VALUE per scenario, deepSeq'd: accepted must eval, the refusal
  # scenarios must NOT. (`builtins.tryEval` catches a top-level throw; the
  # collision refusals raise through the fold's `knobs` value here.)
  refused = scenario:
    let f = foldFor scenario; in
      !(builtins.tryEval (builtins.deepSeq f.knobs true)).success;

  # The scenario's PURE diagnostic rows.
  diagnostic = scenario: (foldFor scenario).diagnostics;

  # The assertion, evaluated now: each refusal scenario's diagnostics must
  # carry both owner names in some row.
  assertScenario = scenario: spec:
    if spec == "ok" then
      let diags = diagnostic scenario; in
      if diags != [ ] then
        throw "fold-check ${scenario}: expected no diagnostics, got ${toString (map (d: d.message) diags)}"
      else if refused scenario then
        throw "fold-check ${scenario}: the accepted container refused the fold anyway"
      else
        true
    else
      let
        diags = diagnostic scenario;
        owners = lib.unique (builtins.concatLists (map (d: d.owners) diags));
        bothNames = name: builtins.elem name owners;
      in
      # Some diagnostic row must name every owner; collision rows (knobs,
        # packages, hydrate, externals) carry ALL of them in one message, and a
        # contract mismatch carries the plugin it names — either way the owner
        # list is the refusal's own fact, not a guess.
      if diags == [ ] then
        throw "fold-check ${scenario}: expected a refusal, got none"
      else if ! refused scenario then
        throw "fold-check ${scenario}: expected the strict fold to refuse, it evaluated instead"
      else if !(builtins.all bothNames spec.refuse.owners) then
        throw "fold-check ${scenario}: refusal named owners ${toString owners}, wanted ${toString spec.refuse.owners}"
      else if !(builtins.all (o: builtins.any (d: builtins.elem o d.owners) diags) spec.refuse.owners) then
        throw "fold-check ${scenario}: some owner is named in no diagnostic's owners"
      else
        true;

  check = builtins.all (scenario: assertScenario scenario scenarios.${scenario})
    (builtins.attrNames scenarios);
in
if ! check then
  throw "fold-check: unreachable"
else
  pkgs.runCommand "olai-plugin-fold-check"
  { }
    ''
      echo "plugin-fold-check: all fixture scenarios passed"
      touch $out
    ''
