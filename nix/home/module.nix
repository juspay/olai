# home-manager module for `olai web` (systemd user unit on Linux, launchd
# agent on macOS). The flake's `homeManagerModules.default` imports this and
# fills in `package`; nothing here names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # `--commit=X` / `--push=X` only where a value was actually chosen. `null` is
  # the default on both, and it is not the same as passing the mode olai would
  # have defaulted to: giving the flag PINS that preference row read-only in
  # every browser looking at this instance, and saying nothing leaves each
  # reader their own (docs/running.md, `vault-level-settings`). A module that
  # helpfully passed `--commit=manual` because that is the default would freeze
  # a control on every single-user deployment.
  gitArgs = lib.optionals (cfg.commit != null) [ "--commit" cfg.commit ]
    ++ lib.optionals (cfg.push != null) [ "--push" cfg.push ];

  # Pure argv for both supervisors. The package bakes OLAI_DIST_DIR (the
  # browser bundle); host/port/dataDir and the git policy are the only service
  # knobs.
  webArgs = [
    (lib.getExe cfg.package)
    "web"
    cfg.dataDir
    "--port"
    (toString cfg.port)
    "--host"
    cfg.host
  ] ++ gitArgs;
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

    commit = lib.mkOption {
      type = lib.types.nullOr (lib.types.enum [ "off" "manual" "auto" ]);
      default = null;
      example = "auto";
      description = ''
        When olai git-commits writes, as this instance's POLICY.

        null (the default) passes no flag: the server commits manually, and
        each browser keeps its own live "Git commit" preference — which is what
        a single-user deployment wants.

        Setting it PINS the preference. The server tells every browser which
        flag it was started with, and they draw that row read-only, naming it,
        so auto-commit is the same for everyone looking at this directory
        rather than whichever browser's preference happens to be set. Never
        hidden and never overridable from a browser.

        manual — a write lands on disk and waits for the Commit button or the
        agent's commit tool. auto — every write commits itself, and browsers
        also record what is waiting once the edits stop. off — olai never
        touches git in this directory (the same as --no-commit).
      '';
    };

    push = lib.mkOption {
      type = lib.types.nullOr (lib.types.enum [ "off" "auto" ]);
      default = null;
      example = "off";
      description = ''
        Whether a commit made in a browser is pushed to the branch's upstream,
        as this instance's policy — null (the default) leaves each browser its
        own "Git push" preference, and a value pins that row read-only in all
        of them, exactly as `commit` above does.

        Two values and not three: a branch that is not pushed on its own is
        pushed by the Push button, so there is no third thing to be.
      '';
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 7714;
      description = ''
        Port to listen on. 7714 is olai's production/deploy port ("olai" on a
        phone keypad). The CLI itself binds port 0 unless --port is given;
        this module always passes --port, so a user service does not wander.
      '';
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
          # One policy, three knobs. Effect's runMain exits 130 on SIGTERM.
          # SuccessExitStatus=130 keeps systemctl stop out of failed.
          # Restart=always (not on-failure) still brings a stray kill -TERM
          # back: on-failure does not restart a successful exit, which is
          # how two outside SIGTERMs left the ledger dark for hours
          # (docs/RCA/2026-08-20-olai-service-sigterm.md). systemd never
          # restarts a unit whose death was a systemd stop or restart
          # (man systemd.service, Restart=).
          Restart = "always";
          RestartSec = "1s";
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
          # A 130 exit is non-zero, so SuccessfulExit=false already restarts
          # it — the Linux incident's case, without needing KeepAlive=true
          # (which would also restart a clean 0 that `olai web` never does;
          # it waits until interrupted). Crashed=true covers a signal death
          # that never became an exit status. launchctl bootout stays a
          # deliberate stop either way.
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
