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
  keyList = pkgs.lib.concatStringsSep " " keys;

  # One `--set-default` per knob. `dir` kinds additionally splice onto PATH in
  # a `--run`, because an unguarded `:$PATH` with PATH unset would smuggle the
  # working directory onto it.
  setDefaults = builtins.concatStringsSep " \\\n          "
    (map (k: "--set-default ${k} \"${knobs.${k}.path}\"") keys);

  # The `OLAI_WRAPPER_DEFAULTS` bookkeeping run: which of the declared knobs
  # the wrapper actually defaulted (left unset by the caller).
  defaultsRun = pkgs.lib.optionalString (keys != [ ]) ''
    --run 'export OLAI_WRAPPER_DEFAULTS=""; for key in ${keyList}; do if [[ ! -v "$key" ]]; then export OLAI_WRAPPER_DEFAULTS="$OLAI_WRAPPER_DEFAULTS''${OLAI_WRAPPER_DEFAULTS:+,}$key"; fi; done' \
  '';

  # One `--run` per `dir` knob: splice the dir onto PATH when it is a
  # directory, skip with a stderr line otherwise. `holds` names the
  # executable the dir is supposed to carry; the message tells a setter which
  # knob and what shape it wants.
  dirRuns = pkgs.lib.concatMapStringsSep " \\\n          "
    (k:
      let d = knobs.${k};
      in if d.kind == "dir" then
        "--run 'if [ -n \"$${${k}}\" ]; then if [ -d \"$${${k}}\" ]; then export PATH=\"$${${k}}\"\"$${PATH:+:$$PATH}\"; else echo \"olai: ${k}=$${${k}} is not a directory — no ${d.holds} goes on the PATH of this serve\" >&2; fi; fi'"
      else "\"\"")
    keys;
in
{
  # The makeWrapper argument text for the packaged `olai` wrapper.
  wrapperArgs = pkgs.lib.concatStringsSep " \\\n      " (
    builtins.filter (s: s != "") ([ defaultsRun ] ++ [ setDefaults ] ++ builtins.filter (s: s != "\"\"") [ dirRuns ])
  );

  # The dev loop's shell snippet: one `export VAR="${VAR-default}"` per knob,
  # the same facts in the same three states (unset → pin, empty → off).
  devEnv = pkgs.lib.concatMapStringsSep "\n"
    (k: "export ${k}=\"\$${${k}-${knobs.${k}.path}}\"")
    keys;
}
