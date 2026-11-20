{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  runtime = import ../runtime.nix { inherit lib; };

  webArgs = runtime.webArgs {
    package = cfg.package;
    inherit (cfg) dataDir host port;
  };
in
{
  options.services.olai = {
    enable = lib.mkEnableOption "olai web view";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The olai package to serve with.";
    };

    dataDir = lib.mkOption {
      # str, not path: these are the user's outlines. A path literal would
      # copy them into the read-only store and `web` would watch the copy.
      type = lib.types.str;
      example = lib.literalExpression ''"''${config.home.homeDirectory}/outlines"'';
      description = ''
        Directory of outlines to serve (*.olai and *.md, read recursively).
        Required — a user unit has no ambient home to fall back on.
      '';
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = runtime.defaultHost;
      description = "Address to listen on. olai has no auth; keep this loopback (or behind Tailscale).";
    };

    environmentFile = lib.mkOption {
      # str, not path: a file of secrets copied into the world-readable nix
      # store is the one mistake this option exists to make easy to avoid.
      type = lib.types.nullOr lib.types.str;
      default = null;
      example = lib.literalExpression ''"''${config.home.homeDirectory}/.config/olai/env"'';
      description = ''
        A file of `NAME=value` lines systemd loads into the service's
        environment (systemd.exec(5) EnvironmentFile). Linux only.

        THE AGENTS OLAI SPAWNS INHERIT THIS PROCESS'S ENVIRONMENT, and nothing
        else — not your login shell's, not your profile's. An agent whose config
        reads a provider key out of the environment (opencode's
        `"apiKey": "{env:JUSPAY_API_KEY}"`) therefore finds it only if olai
        itself was started with it, and one that does not find it fails in the
        quietest way there is: the turn comes back successful with nothing in
        it. That is what this option is for, and website/docs/running.md says what the
        panel does when it happens anyway.

        Keep the file outside the nix store and readable only by you — it is
        read at start, so a change needs a restart.
      '';
    };

    agents = lib.mkOption {
      type = lib.types.listOf lib.types.package;
      default = [ ];
      example = lib.literalExpression "[ pkgs.opencode ]";
      description = ''
        The coding agents this olai may seat, as packages. Non-empty, the
        service is started with `OLAI_AGENT_PATH` set to their `bin`
        directories; empty, the variable is not set at all and olai probes the
        service's own `PATH`, which is what it has always done.

        IT REPLACES RATHER THAN APPENDS, which is the trap this option exists
        to take off a reader. `OLAI_AGENT_PATH` is the whole of where olai
        looks for an engine — listing one agent here means the OTHERS stop
        being found, however installed they are. That is the variable's own
        semantics (website/docs/running.md); naming it as a list of packages is only
        what makes the consequence visible at the place the choice is made.

        It is the unit's environment, so it reaches the agents olai spawns
        too: an agent olai seats is a child of this process and inherits what
        the SERVICE was given, never your login shell's.
      '';
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = runtime.defaultPort;
      description = ''
        Port to listen on; 7714 ("olai" on a phone keypad) is
        `nix/runtime.nix`'s default. The CLI itself binds port 0 unless --port
        is given; this module always passes --port, so a user service does not
        wander.
      '';
    };

  };

  config = lib.mkIf cfg.enable {
    # launchd has no EnvironmentFile — its plist takes an attrset of literal
    # values, which is not a file and not a secret. So the option is refused
    # there rather than silently doing nothing, which is the failure it exists
    # to prevent one layer down.
    assertions = [
      {
        assertion = cfg.environmentFile == null || pkgs.stdenv.hostPlatform.isLinux;
        message = "services.olai.environmentFile is systemd-only; launchd has no equivalent.";
      }
    ];

    home.packages = [ cfg.package ];

    systemd.user.services = lib.mkIf pkgs.stdenv.hostPlatform.isLinux {
      olai = {
        Unit = {
          Description = "olai web view";
          After = [ "network.target" ];
        };
        Service = {
          ExecStart = lib.escapeShellArgs webArgs;
          # Effect's runMain exits 130 on SIGTERM, so SuccessExitStatus=130
          # keeps `systemctl stop` out of failed. Restart=always rather than
          # on-failure: systemd never restarts a unit whose death was a
          # systemd stop or restart (man systemd.service, Restart=), and
          # on-failure would leave a successful exit dark
          # (https://github.com/juspay/oss.olai/blob/main/projects/olai/RCA/2026-08-20-olai-service-sigterm.md).
          Restart = "always";
          RestartSec = "1s";
          SuccessExitStatus = 130;

        } // lib.optionalAttrs (cfg.environmentFile != null) {
          EnvironmentFile = cfg.environmentFile;
        } // lib.optionalAttrs (cfg.agents != [ ]) {
          Environment = [ "OLAI_AGENT_PATH=${lib.makeBinPath cfg.agents}" ];
        };
        Install = {
          WantedBy = [ "default.target" ];
        };
      };
    };

    launchd.agents = lib.mkIf pkgs.stdenv.hostPlatform.isDarwin {
      olai = {
        enable = true;
        config = {
          ProgramArguments = webArgs;
          RunAtLoad = true;
          # A 130 exit is non-zero, so SuccessfulExit=false already restarts
          # it; KeepAlive=true would also restart a clean 0. Crashed=true
          # covers a signal death that never became an exit status.
          KeepAlive = {
            SuccessfulExit = false;
            Crashed = true;
          };
          # launchd otherwise drops the process's output.
          StandardOutPath = "${config.home.homeDirectory}/Library/Logs/olai.out.log";
          StandardErrorPath = "${config.home.homeDirectory}/Library/Logs/olai.err.log";

        } // lib.optionalAttrs (cfg.agents != [ ]) {
          EnvironmentVariables = { OLAI_AGENT_PATH = lib.makeBinPath cfg.agents; };
        };
      };
    };
  };
}
