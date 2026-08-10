# Evaluate a sample `services.olai` configuration against the home-manager
# module without pulling home-manager itself: the options this module reads
# and writes are stubbed, then the resulting systemd / launchd config is
# asserted. Proves evaluation + the argv and supervisor knobs; does not
# prove a real home-manager activation or a live process.
{ pkgs, module }:
let
  inherit (pkgs) lib;

  # Minimal stand-ins for the home-manager options the module touches.
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
    };
  };

  # A throwaway package so this check does not wait on the real olai build.
  # The flake wires the real package via mkDefault; here we only care that
  # getExe lands in argv.
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

  evalFor = platform: lib.evalModules {
    modules = [
      module
      stub
      {
        services.olai = {
          enable = true;
          package = fakeOlai;
          dataDir = "/home/alice/outlines";
          # host/port left at defaults so the asserts below pin them.
        };
      }
    ];
    specialArgs.pkgs = mkPkgs platform;
  };

  linux = evalFor { isLinux = true; isDarwin = false; };
  darwin = evalFor { isLinux = false; isDarwin = true; };

  linuxService = linux.config.systemd.user.services.olai;
  darwinAgent = darwin.config.launchd.agents.olai;
  exe = lib.getExe fakeOlai;

  # --- Linux (systemd) ---------------------------------------------------
  # ExecStart is one escaped string (`lib.escapeShellArgs`). hasInfix is a
  # regex match and refuses store-path contexts, so discard context on the
  # executable path before searching.
  execStart = linuxService.Service.ExecStart;
  exePlain = builtins.unsafeDiscardStringContext exe;
  execPlain = builtins.unsafeDiscardStringContext execStart;
  _linux =
    assert linuxService.Unit.Description == "olai web view";
    assert linuxService.Service.Restart == "on-failure";
    # Effect runMain exits 130 on SIGTERM; without this, clean stops are failed.
    assert linuxService.Service.SuccessExitStatus == 130;
    assert linuxService.Install.WantedBy == [ "default.target" ];
    assert lib.hasInfix exePlain execPlain;
    assert lib.hasInfix " web " execPlain;
    assert lib.hasInfix "/home/alice/outlines" execPlain;
    assert lib.hasInfix "--port 7714" execPlain;
    assert lib.hasInfix "--host 127.0.0.1" execPlain;
    assert linux.config.home.packages == [ fakeOlai ];
    # Darwin path must not fire on Linux.
    assert linux.config.launchd.agents == { };
    true;

  # --- Darwin (launchd) --------------------------------------------------
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
    # Linux path must not fire on Darwin.
    assert darwin.config.systemd.user.services == { };
    true;
in
assert _linux;
assert _darwin;
pkgs.runCommand "olai-hm-module-check" { } ''
  echo "services.olai module evaluates (linux systemd + darwin launchd)"
  touch $out
''
