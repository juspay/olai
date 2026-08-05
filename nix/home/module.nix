# home-manager module for `olai serve` (systemd user unit on Linux, launchd
# agent on macOS). The flake's `homeManagerModules.default` imports this and
# fills in `package`; nothing here names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # Pure argv for both supervisors. The package defaults OLAI_ACP_AGENT;
  # host/port/dataDir are the only service knobs.
  serveArgs = [
    (lib.getExe cfg.package)
    "serve"
    "--port"
    (toString cfg.port)
    "--bind"
    cfg.host
    cfg.dataDir
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
      # copy them into the read-only store and `serve` would watch the copy.
      type = lib.types.str;
      example = lib.literalExpression ''"''${config.home.homeDirectory}/outlines"'';
      description = ''
        Directory of *.rkt outlines to serve. Required — a user unit has no
        ambient home to fall back on.
      '';
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Address to listen on. olai has no auth; keep this loopback (or behind Tailscale).";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "Port to listen on.";
    };
  };

  config = lib.mkIf cfg.enable {
    # The CLI faces (check/tree/agenda/daily) work from any shell on the same
    # files the service serves; the binary cannot skew from the service it
    # inspects.
    home.packages = [ cfg.package ];

    systemd.user.services = lib.mkIf pkgs.stdenv.hostPlatform.isLinux {
      olai = {
        Unit = {
          Description = "olai web view";
          After = [ "network.target" ];
        };
        Service = {
          ExecStart = lib.escapeShellArgs serveArgs;
          Restart = "on-failure";
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
          ProgramArguments = serveArgs;
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
