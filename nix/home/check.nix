{ pkgs, module }:
let
  inherit (pkgs) lib;

  stub = { lib, ... }: {
    options = {
      home.packages = lib.mkOption {
        type = lib.types.listOf lib.types.package;
        default = [ ];
      };
      home.homeDirectory = lib.mkOption {
        type = lib.types.str;
        default = "/home/alice";
      };
      systemd.user.services = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      launchd.agents = lib.mkOption {
        type = lib.types.attrsOf lib.types.anything;
        default = { };
      };
      assertions = lib.mkOption {
        type = lib.types.listOf lib.types.unspecified;
        default = [ ];
      };
    };
  };

  fakeOlai = pkgs.writeShellScriptBin "olai" ''
    echo "fake olai — hm-module check only" >&2
    exit 1
  '';

  mkPkgs = { isLinux, isDarwin }: pkgs // {
    stdenv = pkgs.stdenv // {
      hostPlatform = pkgs.stdenv.hostPlatform // {
        inherit isLinux isDarwin;
      };
    };
  };

  evalFor = platform: settings: lib.evalModules {
    modules = [
      module
      stub
      {
        services.olai = {
          enable = true;
          package = fakeOlai;
          dataDir = "/home/alice/outlines";
        } // settings;
      }
    ];
    specialArgs.pkgs = mkPkgs platform;
  };

  linux = evalFor { isLinux = true; isDarwin = false; } { };
  darwin = evalFor { isLinux = false; isDarwin = true; } { };

  linuxService = linux.config.systemd.user.services.olai;
  darwinAgent = darwin.config.launchd.agents.olai;
  exe = lib.getExe fakeOlai;

  execStart = linuxService.Service.ExecStart;
  exePlain = builtins.unsafeDiscardStringContext exe;
  execPlain = builtins.unsafeDiscardStringContext execStart;
  _linux =
    assert linuxService.Unit.Description == "olai web view";
    assert linuxService.Service.Restart == "always";
    assert linuxService.Service.RestartSec == "1s";
    assert linuxService.Service.SuccessExitStatus == 130;
    assert linuxService.Install.WantedBy == [ "default.target" ];
    assert lib.hasInfix exePlain execPlain;
    assert lib.hasInfix " web " execPlain;
    assert lib.hasInfix "/home/alice/outlines" execPlain;
    assert lib.hasInfix "--port 7714" execPlain;
    assert lib.hasInfix "--host 127.0.0.1" execPlain;
    assert !(lib.hasInfix "--commit" execPlain);
    assert !(lib.hasInfix "--push" execPlain);
    assert !(lib.hasInfix "--plugins" execPlain);
    assert !(lib.hasInfix "--extra-plugins" execPlain);
    assert !(lib.hasInfix "--without-plugins" execPlain);
    assert linux.config.home.packages == [ fakeOlai ];
    assert !(linuxService.Service ? Environment);
    assert linux.config.launchd.agents == { };
    true;

  _removed =
    assert builtins.attrNames linux.options.services.olai ==
      [ "agents" "dataDir" "enable" "environmentFile" "host" "package" "port" ];
    true;

  withEnvFile = evalFor { isLinux = true; isDarwin = false; }
    { environmentFile = "/home/alice/.config/olai/env"; };
  darwinEnvFile = evalFor { isLinux = false; isDarwin = true; }
    { environmentFile = "/home/alice/.config/olai/env"; };
  failed = evaluated:
    builtins.filter (a: !a.assertion) evaluated.config.assertions;
  _env =
    assert !(linuxService.Service ? EnvironmentFile);
    assert withEnvFile.config.systemd.user.services.olai.Service.EnvironmentFile
      == "/home/alice/.config/olai/env";
    assert withEnvFile.config.systemd.user.services.olai.Service.Restart == "always";
    assert failed linux == [ ];
    assert failed darwin == [ ];
    assert builtins.length (failed darwinEnvFile) == 1;
    true;

  fakeAgent = pkgs.writeShellScriptBin "an-agent" "exit 1";
  linuxAgents = evalFor { isLinux = true; isDarwin = false; } { agents = [ fakeAgent ]; };
  darwinAgents = evalFor { isLinux = false; isDarwin = true; } { agents = [ fakeAgent ]; };
  _agents =
    assert !(linuxService.Service ? Environment);
    assert !(darwinAgent.config ? EnvironmentVariables);
    assert linuxAgents.config.systemd.user.services.olai.Service.Environment
      == [ "OLAI_AGENT_PATH=${lib.makeBinPath [ fakeAgent ]}" ];
    assert darwinAgents.config.launchd.agents.olai.config.EnvironmentVariables
      == { OLAI_AGENT_PATH = lib.makeBinPath [ fakeAgent ]; };
    assert linuxAgents.config.systemd.user.services.olai.Service.Restart == "always";
    assert darwinAgents.config.launchd.agents.olai.config.RunAtLoad == true;
    assert failed linuxAgents == [ ];
    assert failed darwinAgents == [ ];
    true;

  args = darwinAgent.config.ProgramArguments;
  _darwin =
    assert darwinAgent.enable == true;
    assert darwinAgent.config.RunAtLoad == true;
    assert darwinAgent.config.KeepAlive.SuccessfulExit == false;
    assert darwinAgent.config.KeepAlive.Crashed == true;
    assert darwinAgent.config.StandardOutPath == "/home/alice/Library/Logs/olai.out.log";
    assert darwinAgent.config.StandardErrorPath == "/home/alice/Library/Logs/olai.err.log";
    assert args == [
      exe
      "web"
      "/home/alice/outlines"
      "--port"
      "7714"
      "--host"
      "127.0.0.1"
    ];
    assert darwin.config.home.packages == [ fakeOlai ];
    assert darwin.config.systemd.user.services == { };
    true;
in
assert _linux;
assert _darwin;
assert _removed;
assert _env;
assert _agents;
pkgs.runCommand "olai-hm-module-check" { } ''
  echo "services.olai module evaluates (linux systemd + darwin launchd)"
  echo "  ... and policy options are absent from both supervisors"
  echo "  ... and environmentFile reaches the unit on Linux, and is refused on Darwin"
  echo "  ... and agents set OLAI_AGENT_PATH on both, and nothing when empty"
  touch $out
''
