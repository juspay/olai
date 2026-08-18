# home-manager module for `olai web` (systemd user unit on Linux, launchd
# agent on macOS). The flake's `homeManagerModules.default` imports this and
# fills in `package`; nothing here names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # Pure argv for both supervisors. The package bakes OLAI_DIST_DIR (the
  # browser bundle); host/port/dataDir are the only service knobs.
  webArgs = [
    (lib.getExe cfg.package)
    "web"
    cfg.dataDir
    "--port"
    (toString cfg.port)
    "--host"
    cfg.host
  ];
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
      default = "127.0.0.1";
      description = "Address to listen on. olai has no auth; keep this loopback (or behind Tailscale).";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 7714;
      description = "Port to listen on. 7714 is olai's own default (\"olai\" on a phone keypad).";
    };
  };

  config = lib.mkIf cfg.enable {
    # Put the same binary the service runs on PATH, so a shell `olai web`
    # cannot skew from the unit it is meant to inspect.
    home.packages = [ cfg.package ];

    systemd.user.services = lib.mkIf pkgs.stdenv.hostPlatform.isLinux {
      olai = {
        Unit = {
          Description = "olai web view";
          After = [ "network.target" ];
        };
        Service = {
          ExecStart = lib.escapeShellArgs webArgs;
          Restart = "on-failure";
          # Effect's runMain exits 130 when the main fiber is interrupted
          # (SIGTERM from systemctl stop / session teardown). Without this,
          # every clean stop lands the unit in failed. The process writes
          # `olai web: received SIGTERM` to stderr first, so a non-systemctl
          # SIGTERM is still a successful unit but is not a silent one.
          SuccessExitStatus = 130;
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
          # Match systemd's on-failure: restart on a non-zero exit OR a crash
          # signal, not only a successful one.
          KeepAlive = {
            SuccessfulExit = false;
            Crashed = true;
          };
          # launchd otherwise drops the process's output.
          StandardOutPath = "${config.home.homeDirectory}/Library/Logs/olai.out.log";
          StandardErrorPath = "${config.home.homeDirectory}/Library/Logs/olai.err.log";
        };
      };
    };
  };
}
