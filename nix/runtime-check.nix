# The flake's public `lib` output consumed the way a container consumes it: no
# home-manager, no supervisor. `nix/home/check.nix` proves the supervisor
# wiring; this proves the half with no supervisor — the argv, the shared
# defaults, and argument passing. It takes `runtime` rather than importing
# `nix/runtime.nix`, so what is tested is the wiring the flake publishes.
{ pkgs, runtime }:
let
  inherit (pkgs) lib;

  # A throwaway package: this check is about argv, not about the build.
  fakeOlai = pkgs.writeShellScriptBin "olai" "exit 1";
  exe = lib.getExe fakeOlai;

  defaults = runtime.webArgs { package = fakeOlai; dataDir = "/data/olai"; };
  explicit = runtime.webArgs {
    package = fakeOlai;
    dataDir = "/data/olai";
    host = "0.0.0.0";
    port = "9000"; # a ConfigMap's word, not a Nix int
  };
  spaced = runtime.webArgs { package = fakeOlai; dataDir = "/data/olai with spaces"; };

  _defaults = assert defaults == [
    exe
    "web"
    "/data/olai"
    "--port"
    "7714"
    "--host"
    "127.0.0.1"
  ]; true;
  _explicit = assert explicit == [
    exe
    "web"
    "/data/olai"
    "--port"
    "9000"
    "--host"
    "0.0.0.0"
  ]; true;
  # One list element, one argv entry: a directory with spaces is not split by
  # execv — and for a supervisor that parses a command line (systemd's
  # ExecStart), escaping is what keeps it whole.
  _spaces =
    assert builtins.elem "/data/olai with spaces" spaced;
    assert lib.hasInfix "'/data/olai with spaces'" (lib.escapeShellArgs spaced);
    true;
  # Shared with the home-manager module's option defaults.
  _shared =
    assert runtime.defaultHost == "127.0.0.1";
    assert runtime.defaultPort == 7714;
    true;
in
assert _defaults;
assert _explicit;
assert _spaces;
assert _shared;
pkgs.runCommand "olai-runtime-args-check" { } ''
  echo "olai runtime argv evaluates without home-manager (downstream direct use)"
  echo "  ... defaults: port 7714, host 127.0.0.1, and a dataDir with spaces stays one argument"
  touch $out
''
