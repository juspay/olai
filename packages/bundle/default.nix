# THE REGISTRY FOLD — `@olai/bundle` is the one package that imports every
# plugin (packages/bundle/olai.yml is the TS registry), so its Nix file is the
# same thing for evaluation. It names no plugin.
#
# The container is `packages/plugins/`. The fold reads it, imports every
# `<dir>/default.nix` that exists, validates the result with `kit.contract`,
# and folds the valid contracts, refusing ANY collision by name. A plugin whose
# directory carries no `default.nix` has no Nix half — the ordinary case (most
# plugins build nothing and find their tools on the PATH) — and is accepted.
#
# Each plugin's `default.nix` is `{ pkgs, pins, kit, b2n ? null }: { ... }`,
# returning the contract attrset of docs/architecture/plugin-system.md §10:
# hydrate / externals / koluSeeds / koluPins / generated / npmTrees / knobs /
# packages / checks. `pins` is this tree's npins, handed in so a plugin names a
# pin by attribute instead of reaching ../../../npins. `kit` is
# packages/plugin-kit/nix.
#
# WHAT THE ROOT READS. The root never names a plugin, and the fold never names
# a knob wiring detail: `packages` (merged flake outputs), `wrapperArgs` (the
# makeWrapper text the `olai` wrapper bakes), `devEnv` (the dev loop's same
# facts), `hydrateScript` (one script for the sandbox and `just install`),
# `externals` / `koluSeeds` / `koluPins` (the dependency-check legs), and
# `checks` (the plugin-contributed Nix checks). One fold, every consumer.
{ pkgs, pins, b2n ? null, container ? ../plugins }:

let
  lib = pkgs.lib;
  kit = import ../plugin-kit { inherit pkgs; };

  # The kolu copier is a plain script in the kolu pin (kolu's consumer.nix
  # names it). The fold runs the SAME script over the plugins' hydrate pairs so
  # a plugin source copies exactly the way a @kolu/* source does — one copier,
  # no second spelling. A fixture container (no `kolu` pin) supplies none and
  # the hydrate script falls back to a no-op.
  koluCopier = if pins ? kolu then "${pins.kolu}/scripts/hydrate-kolu-packages.sh" else null;

  # Subdirectory names of the container that carry a `default.nix`.
  dirs = builtins.filter (n: (builtins.readDir container).${n} == "directory")
    (builtins.attrNames (builtins.readDir container));
  withDoor = builtins.filter (n: builtins.pathExists "${container}/${n}/default.nix") dirs;

  # Import each plugin's door into THREE doors:
  #   `raw`     — the attrset the plugin returned, untouched (always computable).
  #   `problems`— kit.contractProblems, the validator's pure refusals for THIS
  #               plugin (a knob/manifest mismatch, an unknown key, a generated
  #               path without the infix), never thrown.
  #   `strict`  — kit.contract, the validated contract the root composes from;
  #               it throws on `problems` (below, via `refuse`).
  # `diagnostics` is built ONLY from `raw` and `problems` so a check can read a
  # refusal without ever forcing a `throw`.
  pluginsData = builtins.listToAttrs (map
    (name:
      let dir = "${container}/${name}";
          raw = import "${dir}/default.nix" { inherit pkgs pins kit b2n; };
      in { inherit name; value = { inherit dir raw; }; })
    withDoor);

  pluginNames = builtins.attrNames pluginsData;

  # Per-plugin contract refusals (pure), one diagnostic row apiece.
  contractDiagnostics = builtins.concatMap (name:
    let d = pluginsData.${name}; in
    map (message: {
      attr = "contract";
      k = name;
      owners = [ name ];
      inherit message;
    }) (kit.contractProblems { inherit (d) dir; contract = d.raw; name = name; }))
    pluginNames;

  # ---------------------------------------------------------------------------
  # COLLISION DIAGNOSTICS — a PURE, non-throwing projection the strict fold
  # below refuses on, and `fold-check.nix` reads directly. Each row names the
  # contract attr, the colliding key, BOTH owners, and the refusal's message,
  # so a check can assert the refusal names both plugins without capturing a
  # `throw` (Nix exposes no thrown message to the evaluator). Built from
  # `pluginsData.<name>.raw` — the unvalidated attrset — so a contract problem
  # in one plugin does not hide a collision.
  attrUnion = attr:
    builtins.foldl' (acc: name:
      let contrib = pluginsData.${name}.raw.${attr} or { };
          dups = builtins.attrNames (builtins.intersectAttrs contrib acc.owners); in
      {
        union = acc.union // contrib;
        owners = acc.owners //
          builtins.listToAttrs (map (k: { name = k; value = name; })
            (builtins.attrNames contrib));
        collisions = acc.collisions
          ++ map (k: {
            inherit attr k;
            owners = [ acc.owners.${k} name ];
            message = "registry fold: ${attr} '${k}' is claimed by both '${acc.owners.${k}}' and '${name}'";
          }) dups;
      })
      { union = { }; owners = { }; collisions = [ ]; }
      pluginNames;

  unionOf = attr: (attrUnion attr).union;

  # Hydrate dest collisions (the collision is over the COPY DESTINATION —
  # two plugins copying sources into one node_modules dir is an atomic
  # ownership claim broken in two).
  hydrateItems = builtins.concatMap
    (name: map (h: { inherit name; dest = h.dest; src = h.src; })
      (pluginsData.${name}.raw.hydrate or [ ]))
    pluginNames;
  hydrateCollision =
    builtins.foldl' (acc: it:
      if builtins.hasAttr it.dest acc.owners then
        acc // { collisions = acc.collisions ++ [{
          attr = "hydrate";
          k = it.dest;
          owners = [ acc.owners.${it.dest} it.name ];
          message = "registry fold: hydrate dest '${it.dest}' is claimed by both '${acc.owners.${it.dest}}' and '${it.name}'";
        }]; }
      else acc // { owners = acc.owners // { ${it.dest} = it.name; }; })
      { collisions = [ ]; owners = { }; }
      hydrateItems;

  # All diagnostics, one list. The registry is atomic: the strict fold refuses
  # on ANY collision, so one broken contract breaks the whole composition by name.
  diagnostics =
    contractDiagnostics
    ++ (attrUnion "knobs").collisions
    ++ (attrUnion "packages").collisions
    ++ (attrUnion "externals").collisions
    ++ (attrUnion "koluPins").collisions
    ++ hydrateCollision.collisions;

  # REFUSE: when there is any diagnostic, the strict fold fails evaluation by
  # name; otherwise the union is the folded value.
  refuse = value: builtins.foldl' (v: c: throw c.message) value diagnostics;

  # The validated contract for a plugin the root composes from. Forcing any of
  # these on a broken contract throws (the strict door), and `refuse` above
  # already names the same problems, so the two cannot drift.
  contracts = builtins.mapAttrs
    (name: d: kit.contract { inherit name; dir = d.dir; contract = d.raw; })
    pluginsData;

  # The merged per-plugin contributions (each refuses the whole fold on a collision).
  knobs = refuse (unionOf "knobs");
  packages = refuse (unionOf "packages");
  externals = refuse (unionOf "externals");
  koluPins = refuse (unionOf "koluPins");

  koluSeeds = refuse (builtins.concatLists
    (builtins.attrValues (builtins.mapAttrs (name: c: c.koluSeeds or [ ]) contracts)));
  npmTrees = refuse (builtins.concatLists
    (builtins.attrValues (builtins.mapAttrs (name: c: c.npmTrees or [ ]) contracts)));

  # `generated` is keyed by the PLUGIN-PREFIXED path — two plugins may both
  # ship `src/browser/mark.generated.ts`, and the prefix is what makes the union
  # (and the `.gitignore` glob) total. So fold directly with `${name}/${path}`.
  generated = refuse (builtins.foldl' (acc: it: acc // it) { }
    (builtins.concatMap (name:
      builtins.mapAttrs' (path: file:
        { name = "${name}/${path}"; value = file; })
        (contracts.${name}.generated or { }))
      pluginNames));

  hydrate = refuse (map (h: { src = h.src; dest = h.dest; }) hydrateItems);

  # The `checks` contract attr is a function `{ tree } -> attrset`. Fold across
  # plugins, prefixing each check `plugin-<name>-<check>` so two plugins cannot
  # collide, and append the aggregate `plugins` link farm.
  checks = { tree }:
    let
      perPlugin = builtins.foldl' (acc: name:
        acc // builtins.mapAttrs (check: drv: { name = "plugin-${name}-${check}"; value = drv; })
          ((contracts.${name}.checks or (_: { })) { inherit tree; }))
        { } pluginNames;
      linkFarm = pkgs.symlinkJoin {
        name = "olai-plugin-checks";
        paths = builtins.attrValues perPlugin;
      };
    in
    perPlugin // { plugins = linkFarm; };

  # ONE HYDRATE + GENERATED SCRIPT, shared by the sandbox (`base`'s
  # postBunNodeModulesInstallPhase) and the dev shell (`just install`), so the
  # two cannot drift: runs the kolu copier over every plugin's hydrate pairs,
  # then installs every plugin's `generated` file into its own tree.
  hydrateScript = pkgs.writeShellScript "olai-plugin-hydrate"
    ((if koluCopier == null then
      "true"
    else
      lib.concatMapStringsSep "\n" (p: "sh ${koluCopier} ${p.src} ${p.dest}") hydrate)
    + lib.concatMapStringsSep "\n"
      (path: "install -m 644 ${generated.${path}} ${container}/${path}")
      (builtins.attrNames generated));

  # DEV-ONLY INSTALL: `npm ci` in every declared npmTrees dir (announced on
  # stderr, npm's own quiet flags), then hydrateScript. `npm ci` is what lets a
  # test that resolves a pin's node_modules (the mcp bridge's) run in the dev
  # shell; the sandbox never runs this.
  devInstallScript = pkgs.writeShellScript "olai-plugin-dev-install"
    (lib.concatMapStringsSep "\n" (dir:
      "echo >&2 \"cd ${container}/${dir} && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund\"\n"
      + "cd ${container}/${dir} && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund")
      npmTrees
    + (if npmTrees == [ ] then "" else "\n")
    + "sh ${hydrateScript}");

  # The knob table rendered two ways — the wrapper's makeWrapper args and the
  # dev loop's export snippet. One function, two renderings (kit.knobShell).
  knobShell = kit.knobShell { inherit knobs; };

  devEnv = pkgs.writeText "olai-plugin-env"
    ''# The plugin env, rendered by the registry fold (packages/bundle/default.nix).
    # An unset knob answers the pin; an empty one is the off switch. Do not edit.
    ${knobShell.devEnv}
    '';
in
{
  # The validated contracts, for anything that needs to iterate plugins.
  inherit contracts;

  # The PURE collision rows, for `nix/fold-check.nix`: each names the attr,
  # the key, both owners, and the refusal message. The strict fold above
  # refuses on the same rows, so a green diagnostics check and a green build
  # are the same fact.
  inherit diagnostics;

  # Everything the root composes reads the fold:
  inherit hydrate hydrateScript devInstallScript externals koluSeeds koluPins knobs packages checks devEnv generated;
  wrapperArgs = knobShell.wrapperArgs;
}