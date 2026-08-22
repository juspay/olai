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
      # The module refuses `environmentFile` on Darwin rather than dropping it,
      # so the check needs somewhere for that refusal to land.
      assertions = lib.mkOption {
        type = lib.types.listOf lib.types.unspecified;
        default = [ ];
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

  evalFor = platform: settings: lib.evalModules {
    modules = [
      module
      stub
      {
        services.olai = {
          enable = true;
          package = fakeOlai;
          dataDir = "/home/alice/outlines";
          # host/port left at defaults so the asserts below pin them.
        } // settings;
      }
    ];
    specialArgs.pkgs = mkPkgs platform;
  };

  linux = evalFor { isLinux = true; isDarwin = false; } { };
  darwin = evalFor { isLinux = false; isDarwin = true; } { };

  # The same module with a git policy set — the `vault-level-settings` half.
  pinned = evalFor { isLinux = true; isDarwin = false; } {
    commit = "auto";
    push = "off";
  };

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
    assert linuxService.Service.Restart == "always";
    assert linuxService.Service.RestartSec == "1s";
    # Effect runMain exits 130 on SIGTERM; without this, clean stops are failed.
    # Kept with Restart=always: a stray SIGTERM must come back, and a
    # systemctl stop must not land the unit in failed.
    assert linuxService.Service.SuccessExitStatus == 130;
    assert linuxService.Install.WantedBy == [ "default.target" ];
    assert lib.hasInfix exePlain execPlain;
    assert lib.hasInfix " web " execPlain;
    assert lib.hasInfix "/home/alice/outlines" execPlain;
    assert lib.hasInfix "--port 7714" execPlain;
    assert lib.hasInfix "--host 127.0.0.1" execPlain;
    # NO GIT FLAG when neither option is set, and that is the whole default of
    # `vault-level-settings` rather than a saving: giving `--commit` at all pins
    # that preference row read-only in every browser, so a module that helpfully
    # passed the mode olai would have defaulted to anyway would freeze a control
    # on every single-user deployment.
    assert !(lib.hasInfix "--commit" execPlain);
    assert !(lib.hasInfix "--push" execPlain);
    assert linux.config.home.packages == [ fakeOlai ];
    # Darwin path must not fire on Linux.
    assert linux.config.launchd.agents == { };
    true;

  # --- the git policy, when an operator states one ------------------------
  execOf = evaluated: builtins.unsafeDiscardStringContext
    evaluated.config.systemd.user.services.olai.Service.ExecStart;
  pinnedExec = execOf pinned;
  # Only committing pinned, to show the two options are independent: an
  # operator who ruled on committing has not silently ruled on pushing.
  commitOnlyExec = execOf
    (evalFor { isLinux = true; isDarwin = false; } { commit = "off"; });
  _pinned =
    assert lib.hasInfix "--commit auto" pinnedExec;
    assert lib.hasInfix "--push off" pinnedExec;
    assert lib.hasInfix "--commit off" commitOnlyExec;
    assert !(lib.hasInfix "--push" commitOnlyExec);
    true;

  # --- the environment agents inherit ------------------------------------
  # No EnvironmentFile unless one was named: an empty setting is not a file
  # systemd should be told to read.
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
    # Nothing else moved: the file is an addition to the unit, not a rewrite.
    assert withEnvFile.config.systemd.user.services.olai.Service.Restart == "always";
    # ... and launchd, which has no such knob, REFUSES rather than dropping it.
    assert failed linux == [ ];
    assert failed darwin == [ ];
    assert builtins.length (failed darwinEnvFile) == 1;
    true;

  # --- Darwin (launchd) --------------------------------------------------
  args = darwinAgent.config.ProgramArguments;
  _darwin =
    assert darwinAgent.enable == true;
    assert darwinAgent.config.RunAtLoad == true;
    # launchd.plist(5): SuccessfulExit=false restarts on a non-zero exit,
    # so a 130 (Effect's SIGTERM) already comes back. Crashed=true is the
    # signal-death arm.
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
assert _pinned;
assert _env;
pkgs.runCommand "olai-hm-module-check" { } ''
  echo "services.olai module evaluates (linux systemd + darwin launchd)"
  echo "  ... and the git policy options reach argv only when they are set"
  echo "  ... and environmentFile reaches the unit on Linux, and is refused on Darwin"
  touch $out
''
