{ pkgs, runtime }:
let
  inherit (pkgs) lib;

  fakeOlai = pkgs.writeShellScriptBin "olai" "exit 1";
  exe = lib.getExe fakeOlai;

  defaults = runtime.webArgs { package = fakeOlai; dataDir = "/data/olai"; };
  explicit = runtime.webArgs {
    package = fakeOlai;
    dataDir = "/data/olai";
    host = "0.0.0.0";
    port = "9000";
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
  _spaces =
    assert builtins.elem "/data/olai with spaces" spaced;
    assert lib.hasInfix "'/data/olai with spaces'" (lib.escapeShellArgs spaced);
    true;
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
