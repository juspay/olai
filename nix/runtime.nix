{ lib }:
let
  defaultHost = "127.0.0.1";
  defaultPort = 7714;
in
{
  inherit defaultHost defaultPort;

  webArgs = { package, dataDir, host ? defaultHost, port ? defaultPort }:
    [ (lib.getExe package) "web" dataDir "--port" (toString port) "--host" host ];
}
