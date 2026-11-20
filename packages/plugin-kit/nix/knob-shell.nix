{ pkgs }:
{ knobs }:
let
  keys = builtins.attrNames knobs;
  allKeys = keys;
  keyList = pkgs.lib.concatStringsSep " " allKeys;

  setDefaults = pkgs.lib.concatStringsSep " "
    (map (k: "--set-default ${k} \"${knobs.${k}.path}\"") keys);
  defaultsRun = pkgs.lib.optionalString (allKeys != [ ])
    ''--run 'export OLAI_WRAPPER_DEFAULTS=""; for key in ${keyList}; do if [[ ! -v "$key" ]]; then export OLAI_WRAPPER_DEFAULTS="$OLAI_WRAPPER_DEFAULTS''${OLAI_WRAPPER_DEFAULTS:+,}$key"; fi; done' '';

  dirRunLines = builtins.filter (s: s != "")
    (map
      (k:
        let d = knobs.${k};
        in if d.kind == "dir" then
          "--run 'if [ -n \"\${${k}}\" ]; then if [ -d \"\${${k}}\" ]; then export PATH=\"\${${k}}\"\"\${PATH:+:\$PATH}\"; else echo \"olai: ${k}=\${${k}} is not a directory — no ${d.holds} goes on the PATH of this serve\" >&2; fi; fi'"
        else "")
      keys);
in
{
  wrapperArgs = pkgs.lib.concatStringsSep " "
    ([ defaultsRun ] ++ [ setDefaults ] ++ dirRunLines);

  devEnv = pkgs.lib.concatMapStringsSep "\n"
    (k: "export ${k}=\"\${${k}-${knobs.${k}.path}}\"")
    keys;

  knobsTable = pkgs.lib.concatMapStringsSep "\n"
    (k:
      let d = knobs.${k};
      in ''${k}	${d.kind}	${d.path}	${if (d.holds or null) == null then "" else d.holds}'')
    keys;
}
