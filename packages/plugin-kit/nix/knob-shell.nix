# THE KNOB, SAID ONCE — one function, two renderings, so the packaged wrapper
# and the dev loop cannot say different things about a variable.
#
# A knob table is an attrset var → { kind = "file"; path; } or
# { kind = "dir"; path; holds = "<exe>"; } (contract.nix). Each entry is one
# executable a plugin ships: `file` names the executable itself
# (`OLAI_ACP_AGENT`), `dir` names a bin DIRECTORY to splice onto PATH and the
# executable it is supposed to hold (`OLAI_ODU_BIN` → `odu`).
#
# Both renderings keep the same semantics the wrapper had when every knob was
# hand-written:
#   - `--set-default` substitutes only when the variable is UNSET, so an
#     empty value survives it and stays the explicit off switch;
#   - the `dir` arm's guard is verbatim the guard default.nix today carries: a
#     set-but-not-a-directory value is skipped with a stderr line (the row then
#     says the rest) rather than a serve refusing to boot over one mis-set knob;
#   - the `OLAI_WRAPPER_DEFAULTS` loop records which knobs the wrapper promised,
#     so the settings panel can label a row wrapper-provided end to end.
#
# `devEnv` is the dev loop's spelling of the same facts — `export VAR="${VAR-default}"`
# — read by the shell, exactly as `wrapperArgs` is read by makeWrapper. The dev
# shell then answers the pin when unset and off when empty, like the wrapper.
{ pkgs }:
{ knobs }:
let
  keys = builtins.attrNames knobs;
  # `OLAI_WRAPPER_DEFAULTS` records every knob the wrapper promised.
  allKeys = keys;
  keyList = pkgs.lib.concatStringsSep " " allKeys;

  # One `--set-default` per knob. `dir` kinds additionally splice onto PATH in
  # a `--run`, because an unguarded `:$PATH` with PATH unset would smuggle the
  # working directory onto it.
  setDefaults = pkgs.lib.concatStringsSep " "
    (map (k: "--set-default ${k} \"${knobs.${k}.path}\"") keys);
  defaultsRun = pkgs.lib.optionalString (allKeys != [ ])
    ''--run 'export OLAI_WRAPPER_DEFAULTS=""; for key in ${keyList}; do if [[ ! -v "$key" ]]; then export OLAI_WRAPPER_DEFAULTS="$OLAI_WRAPPER_DEFAULTS''${OLAI_WRAPPER_DEFAULTS:+,}$key"; fi; done' '';

  # One `--run` per `dir` knob: splice the dir onto PATH when it is a
  # directory, skip with a stderr line otherwise. `holds` names the
  # executable the dir is supposed to carry; the message tells a setter which
  # knob and what shape it wants.
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
  # The makeWrapper argument text for the packaged `olai` wrapper. Each entry
  # is ONE complete makeWrapper arg; joining with " " lets makeWrapper parse
  # them as sequenced flags, no continuation backslashes needed.
  wrapperArgs = pkgs.lib.concatStringsSep " "
    ([ defaultsRun ] ++ [ setDefaults ] ++ dirRunLines);

  # The dev loop's shell snippet: one `export VAR="${VAR-default}"` per knob.
  # The value the `-` substitutes when VAR is unset is the knob's path —
  # `export OLAI_ODU_BIN="${OLAI_ODU_BIN-/nix/store/.../bin}"` — so the dev
  # shell and the wrapper answer the pin the same three ways (unset → pin,
  # empty → off, a value → that value). `\${` is the double-quoted-string
  # escape for a literal `${` in Nix.
  devEnv = pkgs.lib.concatMapStringsSep "\n"
    (k: "export ${k}=\"\${${k}-${knobs.${k}.path}}\"")
    keys;

  # The fold's knobs as TAB-SEPARATED lines — one `name\tkind\tpath\tholds`
  # per knob — so `just nix` reads them with `while read` and never needs jq.
  knobsTable = pkgs.lib.concatMapStringsSep "\n"
    (k:
      let d = knobs.${k};
      in ''${k}	${d.kind}	${d.path}	${if (d.holds or null) == null then "" else d.holds}'')
    keys;
}
