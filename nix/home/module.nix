# home-manager module for `olai serve` (systemd user unit on Linux, launchd
# agent on macOS — same split as kolu's nix/home/module.nix). The flake's
# `homeModules.default` imports this and fills in `package`; nothing here
# names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # One wrapper script, both supervisors. The ACP agent is not an option:
  # `serve` refuses to start without one, and the bundled adapter is the only
  # agent the flake ships (`nix run` makes the same call). Precedence matches
  # the CLI elsewhere: an exported OLAI_ACP_AGENT wins, the wrapper sets it
  # only when unset.
  envScript = ''
    export OLAI_ACP_AGENT="''${OLAI_ACP_AGENT:-${cfg.acpAgent}/bin/claude-agent-acp}"
    exec ${lib.getExe cfg.package} serve --port ${toString cfg.port} --bind ${cfg.host} "$@"
  '';

  serveArgs = [
    "${pkgs.writeShellScript "olai-serve" envScript}"
    (toString cfg.dataDir)
  ];
in
{
  options.services.olai = {
    enable = lib.mkEnableOption "olai web view";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The olai package to serve with.";
    };

    acpAgent = lib.mkOption {
      type = lib.types.package;
      description = ''
        Package whose bin/claude-agent-acp is handed to `serve` via
        OLAI_ACP_AGENT (the chat panel's agent). A `package`, not a path:
        the adapter drags a node closure, and a str would garbage-collect
        it out from under the unit.
      '';
    };

    dataDir = lib.mkOption {
      # str, not path: these are the user's outlines. A path literal would
      # copy them into the read-only store and `serve` would watch the copy.
      type = lib.types.str;
      example = lib.literalExpression ''"''${config.home.homeDirectory}/Dropbox/Selfflowy-Srid"'';
      description = ''
        Directory of *.rkt outlines to serve (your $OLAI_HOME). olai itself
        defaults to ~/Dropbox/Selfflowy-Srid, but a user unit must not guess
        whose Dropbox that is — set it.
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
    # inspects. Same reasoning as kolu's cliPackage, minus the opt-out.
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
