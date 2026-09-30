# The command olai is launched with; nothing about what launches it. The
# home-manager module wraps a systemd/launchd supervisor around this, a
# container takes it from the flake's `lib` output, and the deploy host and
# port are written here once.
{ lib }:
let
  defaultHost = "127.0.0.1";
  # "olai" on a phone keypad. The CLI's own default is 0 — the OS picks — and
  # a supervised or containerised serve passes a fixed port so its address
  # does not move.
  defaultPort = 7714;
in
{
  inherit defaultHost defaultPort;

  # The argv of `olai web <dataDir>`. A list, passed to execv, so an argument
  # with spaces stays one argument; `dataDir` is a string, not a path literal
  # (a literal would copy the outlines into the read-only store to watch).
  webArgs = { package, dataDir, host ? defaultHost, port ? defaultPort }:
    [ (lib.getExe package) "web" dataDir "--port" (toString port) "--host" host ];
}
