# home-manager module for `olai web` (systemd user unit on Linux, launchd
# agent on macOS). The flake's `homeManagerModules.default` imports this and
# fills in `package`; nothing here names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # `--commit=X` / `--push=X` only where a value was actually chosen. `null` is
  # the default on both, and it is not the same as passing the mode olai would
  # have defaulted to: giving the flag PINS that preference row read-only in
  # every browser looking at this instance, and saying nothing leaves the rows
  # live — they set this same server's policy either way, and what a reader
  # chose is remembered outside the vault (docs/running.md,
  # `git-policy-server-side`). A module that helpfully passed `--commit=manual`
  # because that is the default would freeze a control on every single-user
  # deployment.
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

        Committing is a fact about the DIRECTORY, so the server holds it and
        every browser draws the same answer. null (the default) passes no flag:
        the server commits manually until somebody moves the "Git commit" row
        in the preferences panel, and what they chose is remembered outside the
        vault (under $XDG_STATE_HOME) — which is what a single-user deployment
        wants.

        Setting it PINS the row. The server tells every browser which flag it
        was started with, and they draw that row read-only, naming it, so no
        reader can change this instance's policy from a preferences panel.
        Never hidden and never overridable from a browser.

        manual — a write lands on disk and waits for the Commit button or the
        agent's commit tool. auto — everything waiting records itself once
        writes stop arriving for fifteen seconds, whoever made them, and with
        no browser open at all. off — olai never touches git in this directory
        (the same as --no-commit).
      '';
    };

    push = lib.mkOption {
      type = lib.types.nullOr (lib.types.enum [ "off" "auto" ]);
      default = null;
      example = "off";
      description = ''
        Whether a settled commit is pushed to the branch's upstream, as this
        instance's policy — null (the default) leaves the "Git push" row live
        for whoever is looking, and a value pins it read-only, exactly as
        `commit` above does.

        auto follows EVERY commit olai makes in this directory: the Commit
        button's, an agent's commit tool's, and the quiet window's own. So
        commit = "auto" beside push = "auto" records and shares a directory
        nobody has a tab open on.

        Two values and not three: a branch that is not pushed on its own is
        pushed by the Push button, so there is no third thing to be.
      '';
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
        it. That is what this option is for, and docs/running.md says what the
        panel does when it happens anyway.

        Keep the file outside the nix store and readable only by you — it is
        read at start, so a change needs a restart.
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

    logLevel = lib.mkOption {
      type = lib.types.nullOr (lib.types.enum [ "debug" "info" "warn" "error" ]);
      default = null;
      example = "debug";
      description = ''
        Minimum log level for this instance (`OLAI_LOG_LEVEL`).

        null (the default) sets nothing: the process stays at info, which is
        what olai itself defaults to — lifecycle lines on, agent stderr off.

        debug turns on the rest, including everything the chat agent writes to
        its stderr (JSON-RPC errors live there). This is an instance fact, like
        `--commit`, not a per-browser preference; see docs/running.md.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    # launchd has no EnvironmentFile — its plist takes an attrset of literal
    # values, which is not a file and not a secret. So the option is refused
    # there rather than silently doing nothing, which is the failure it exists
    # to prevent one layer down.
    assertions = [{
      assertion = cfg.environmentFile == null || pkgs.stdenv.hostPlatform.isLinux;
      message = "services.olai.environmentFile is systemd-only; launchd has no equivalent.";
    }];

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
          # (https://github.com/juspay/oss.olai/blob/main/olai/RCA/2026-08-20-olai-service-sigterm.md). systemd never
          # restarts a unit whose death was a systemd stop or restart
          # (man systemd.service, Restart=).
          Restart = "always";
          RestartSec = "1s";
          SuccessExitStatus = 130;
        } // lib.optionalAttrs (cfg.logLevel != null) {
          Environment = [ "OLAI_LOG_LEVEL=${cfg.logLevel}" ];
        } // lib.optionalAttrs (cfg.environmentFile != null) {
          EnvironmentFile = cfg.environmentFile;
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
        } // lib.optionalAttrs (cfg.logLevel != null) {
          EnvironmentVariables = { OLAI_LOG_LEVEL = cfg.logLevel; };
        };
      };
    };
  };
}
