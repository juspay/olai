{ pkgs
, pins
, b2n ? null
, containerDir ? ../plugins
, containerInTree ? "packages/plugins"
}:

let
  lib = pkgs.lib;
  kit = import ../plugin-kit { inherit pkgs pins; };

  koluCopier = if pins ? kolu then "${pins.kolu}/scripts/hydrate-kolu-packages.sh" else null;
  dirs = builtins.filter (n: (builtins.readDir containerDir).${n} == "directory")
    (builtins.attrNames (builtins.readDir containerDir));
  withDoor = builtins.filter (n: builtins.pathExists "${containerDir}/${n}/default.nix") dirs;

  pluginsData = builtins.listToAttrs (map
    (name:
      let
        dir = "${containerDir}/${name}";
        raw = import "${dir}/default.nix" { inherit pkgs pins kit b2n; };
      in
      { inherit name; value = { inherit dir raw; }; })
    withDoor);

  pluginNames = builtins.attrNames pluginsData;

  contractDiagnostics = builtins.concatMap
    (name:
      let d = pluginsData.${name}; in
      map
        (message: {
          attr = "contract";
          k = name;
          owners = [ name ];
          inherit message;
        })
        (kit.contractProblems { inherit (d) dir; contract = d.raw; name = name; }))
    pluginNames;

  attrUnion = attr:
    builtins.foldl'
      (acc: name:
        let
          contrib = pluginsData.${name}.raw.${attr} or { };
          dups = builtins.attrNames (builtins.intersectAttrs contrib acc.owners);
        in
        {
          union = acc.union // contrib;
          owners = acc.owners //
            builtins.listToAttrs (map (k: { name = k; value = name; })
              (builtins.attrNames contrib));
          collisions = acc.collisions
            ++ map
            (k: {
              inherit attr k;
              owners = [ acc.owners.${k} name ];
              message = "registry fold: ${attr} '${k}' is claimed by both '${acc.owners.${k}}' and '${name}'";
            })
            dups;
        })
      { union = { }; owners = { }; collisions = [ ]; }
      pluginNames;

  hydrateItems = builtins.concatMap
    (name: map (h: { inherit name; dest = h.dest; src = h.src; })
      (pluginsData.${name}.raw.hydrate or [ ]))
    pluginNames;
  hydrateCollision =
    builtins.foldl'
      (acc: it:
        if builtins.hasAttr it.dest acc.owners then
          acc // {
            collisions = acc.collisions ++ [{
              attr = "hydrate";
              k = it.dest;
              owners = [ acc.owners.${it.dest} it.name ];
              message = "registry fold: hydrate dest '${it.dest}' is claimed by both '${acc.owners.${it.dest}}' and '${it.name}'";
            }];
          }
        else acc // { owners = acc.owners // { ${it.dest} = it.name; }; })
      { collisions = [ ]; owners = { }; }
      hydrateItems;

  diagnostics =
    contractDiagnostics
    ++ (attrUnion "knobs").collisions
    ++ (attrUnion "packages").collisions
    ++ (attrUnion "externals").collisions
    ++ (attrUnion "koluPins").collisions
    ++ hydrateCollision.collisions;

  refuse = value: builtins.foldl' (v: c: throw c.message) value diagnostics;

  contracts = builtins.mapAttrs
    (name: d: kit.contract { inherit name; dir = d.dir; contract = d.raw; })
    pluginsData;


  unionFromContracts = attr:
    builtins.foldl'
      (acc: name:
        let
          contrib = contracts.${name}.${attr} or { };
          dups = builtins.attrNames (builtins.intersectAttrs contrib acc.owners);
        in
        {
          union = acc.union // contrib;
          owners = acc.owners //
            builtins.listToAttrs (map (k: { name = k; value = name; })
              (builtins.attrNames contrib));
          collisions = acc.collisions
            ++ map
            (k: {
              inherit attr k;
              owners = [ acc.owners.${k} name ];
              message = "registry fold: ${attr} '${k}' is claimed by both '${acc.owners.${k}}' and '${name}'";
            })
            dups;
        })
      { union = { }; owners = { }; collisions = [ ]; }
      pluginNames;

  unionOfContracts = attr: (unionFromContracts attr).union;

  knobs = refuse (unionOfContracts "knobs");
  packages = refuse (unionOfContracts "packages");
  externals = refuse (unionOfContracts "externals");
  koluPins = refuse (unionOfContracts "koluPins");

  koluSeeds = refuse (builtins.concatLists
    (builtins.attrValues (builtins.mapAttrs (name: c: c.koluSeeds or [ ]) contracts)));
  npmTrees = refuse (builtins.concatLists
    (builtins.attrValues (builtins.mapAttrs
      (name: c:
        map (dir: "${name}/${dir}") (c.npmTrees or [ ])
      )
      contracts)));

  generated = refuse (builtins.foldl' (acc: it: acc // it) { }
    (map
      (name:
        lib.mapAttrs'
          (path: file:
            { name = "${name}/${path}"; value = file; })
          (contracts.${name}.generated or { }))
      pluginNames));

  hydrateItemsFromContracts = builtins.concatMap
    (name: map
      (h: { inherit name; dest = h.dest; src = h.src; })
      (contracts.${name}.hydrate or [ ]))
    pluginNames;

  hydrate = refuse (map (h: { src = h.src; dest = h.dest; }) hydrateItemsFromContracts);

  checks = { tree }:
    let
      perPlugin = builtins.foldl'
        (acc: name:
          acc // lib.mapAttrs' (check: drv: { name = "plugin-${name}-${check}"; value = drv; })
            ((contracts.${name}.checks or (_: { })) { inherit tree; }))
        { }
        pluginNames;
      linkFarm = pkgs.symlinkJoin {
        name = "olai-plugin-checks";
        paths = builtins.attrValues perPlugin;
      };
    in
    perPlugin // { plugins = linkFarm; };

  hydrateScript = pkgs.writeShellScript "olai-plugin-hydrate"
    (lib.concatStringsSep "\n"
      ((if koluCopier == null then [ "true" ] else
      map (p: "sh ${koluCopier} ${p.src} ${p.dest}") hydrate)
      ++ map (path: "install -m 644 ${generated.${path}}/${builtins.baseNameOf path} ${containerInTree}/${path}")
        (builtins.attrNames generated)));

  devInstallScript = pkgs.writeShellScript "olai-plugin-dev-install"
    (lib.concatMapStringsSep "\n"
      (dir:
        "echo >&2 \"(cd ${containerInTree}/${dir} && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund)\"\n"
          + "(cd ${containerInTree}/${dir} && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund)")
      npmTrees
    + (if npmTrees == [ ] then "" else "\n")
    + "sh ${hydrateScript}");

  knobShell = kit.knobShell { inherit knobs; };

  devEnv = pkgs.writeText "olai-plugin-env"
    ''# The plugin env, rendered by the registry fold (packages/bundle/default.nix).
    # An unset knob answers the pin; an empty one is the off switch. Do not edit.
    ${knobShell.devEnv}
    '';
in
{
  inherit contracts;

  inherit diagnostics;

  inherit hydrate hydrateScript devInstallScript externals koluSeeds koluPins knobs packages checks devEnv generated;
  wrapperArgs = knobShell.wrapperArgs;
  knobsTable = knobShell.knobsTable;
}
