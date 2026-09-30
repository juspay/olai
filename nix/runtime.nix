# The argv olai is launched with, and nothing about what launches it. Two
# consumers — `nix/home/module.nix` (systemd/launchd around it) and a
# container, which takes the module through the flake's `lib` output — and
# neither spells the flags. Also the one place the deploy host and port are
# written, so the service's defaults and a deployment's cannot drift.
{ lib }:
let
  defaultHost = "127.0.0.1";
  # "olai" on a phone keypad. The CLI's own default is 0 (the OS picks); a
  # supervised or containerised serve passes a fixed port so its address does
  # not move.
  defaultPort = 7714;
in
{
  inherit defaultHost defaultPort;

  # The whole argv of `olai web <dataDir>`, for a caller that has the package.
  # A list, passed to execv, so an argument with spaces stays one argument.
  # `dataDir` is a string, never a path literal: a literal would copy the
  # user's outlines into the read-only store for the server to watch.
  webArgs = { package, dataDir, host ? defaultHost, port ? defaultPort }:
    [ (lib.getExe package) "web" dataDir "--port" (toString port) "--host" host ];
}
