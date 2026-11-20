{ pkgs }:

let
  lib = pkgs.lib;
  pins = import ../../npins;

  foldFor = scenario: import ../default.nix {
    inherit pkgs pins;
    b2n = null;
    containerDir = ./fixtures/${scenario};
    containerInTree = "packages/bundle/nix/fold-check-fixtures/${scenario}";
  };

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

  refused = scenario:
    let f = foldFor scenario; in
      !(builtins.tryEval (builtins.deepSeq f.knobs true)).success;

  diagnostic = scenario: (foldFor scenario).diagnostics;

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
