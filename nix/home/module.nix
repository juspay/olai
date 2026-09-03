# home-manager module for `olai web` (systemd user unit on Linux, launchd
# agent on macOS). The flake's `homeManagerModules.default` imports this and
# fills in `package`; nothing here names a store path.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.olai;

  # `--commit=X` / `--push=X` only where a value was actually chosen. `null` is
  # the default on both, and it is not the same as passing the mode olai would
  # have defaulted to: giving the flag names it under the row, and saying
  # nothing applies the built-in default. Both rows are always read-only — the
  # instance's policy, the same in every browser. A module that helpfully
  # passed `--commit=manual` because that is the default would claim a flag
  # nobody typed.
  gitArgs = lib.optionals (cfg.commit != null) [ "--commit" cfg.commit ]
    ++ lib.optionals (cfg.push != null) [ "--push" cfg.push ];

  # ...and `--plugins`, on exactly the same terms. `null` is nobody having said,
  # which is not the same as saying NONE: an omitted flag applies the built-in
  # default and an empty list passes `--plugins ""`, which is somebody saying
  # none out loud. The preferences panel reads the two differently — one names
  # the flag under the row, the other names the default — so a module that
  # helpfully expanded `null` into a list would claim a flag nobody typed,
  # exactly as `gitArgs` above refuses to.
  #
  # A COMMA LIST because that is what the flag takes; `concatStringsSep` and not a
  # repeated flag, since the CLI reads one value.
  pluginArgs = lib.optionals (cfg.plugins != null)
    [ "--plugins" (lib.concatStringsSep "," cfg.plugins) ];

  # Pure argv for both supervisors. The package bakes OLAI_DIST_DIR (the
  # browser bundle); host/port/dataDir, the git policy and the plugin list are
  # the only service knobs.
  webArgs = [
    (lib.getExe cfg.package)
    "web"
    cfg.dataDir
    "--port"
    (toString cfg.port)
    "--host"
    cfg.host
  ] ++ gitArgs ++ pluginArgs;
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
        every browser draws the same answer, always read-only. null (the
        default) passes no flag: the built-in default applies (`manual` — a
        write waits for the Commit button or the agent's commit tool).

        Setting it names the flag under the row. The server tells every browser
        which flag it was started with. Never hidden and never overridable from
        a browser. There is no runtime door.

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
        instance's policy — null (the default) applies the built-in default
        (`off`), and a value names the flag under the row, exactly as `commit`
        above does. The row is always read-only.

        auto follows EVERY commit olai makes in this directory: the Commit
        button's, an agent's commit tool's, and the quiet window's own. So
        commit = "auto" beside push = "auto" records and shares a directory
        nobody has a tab open on.

        Two values and not three: a branch that is not pushed on its own is
        pushed by the Push button, so there is no third thing to be.
      '';
    };

    plugins = lib.mkOption {
      # A LIST OF STRINGS and deliberately not an enum: which plugins a build
      # has is the BINARY's fact, and a nix option that enumerated them would be
      # a second copy of the registry — one this file would have to be edited to
      # keep in step, in a repo whose whole thesis is that no general place
      # spells a plugin's name. The binary is the authority and it refuses an
      # unknown name ONCE, loudly, with the legal words beside it
      # (`olai web --plugins nope` names what this build actually has). A wrong
      # value here is a service that fails to start with that sentence in its
      # journal, which is the right place for it.
      type = lib.types.nullOr (lib.types.listOf lib.types.str);
      default = null;
      example = lib.literalExpression ''[ "odu" ]'';
      description = ''
        Which of the built-in integrations this instance runs, as this
        instance's POLICY — the same shape `commit` and `push` above have, and
        for the same reason: it is a fact about the SERVE, so the server holds
        it and every browser draws the same answer, always read-only. There is
        no settings file and no browser toggle.

        null (the default) passes no flag and applies the built-in default.
        That is NOT the same as listing every plugin this build has: a plugin
        may be opt-in, and the binary is the authority for which. An omitted
        flag draws "the built-in default" under the preferences row, where a
        given one names the flag.

        The empty list is somebody saying NONE out loud, and it is a real,
        supported state — a box with no CI tooling and no agent terminals runs
        a whole olai with no plugin composed at all: no sibling on the wire, no
        probe, no chrome pill, and every property that would have worn a live
        face drawing as the text it always was.

        THE ACP ENGINES ARE ROWS TOO (`claude`, `opencode`, `pi`), so a list
        that names none of them is an instance with no chat panel — the flag
        doing what it says rather than a trap, but worth knowing before you
        write `[ "odu" ]` and wonder where the agent went. Name the engines you
        want beside the appliances.

        Run `olai web --help` for the names this build has.
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
          # Restart=always (not on-failure) is still the right answer to
          # every death that CAN kill this server: SIGKILL, the OOM killer,
          # a crash — a stray kill -TERM no longer can (the server catches
          # TERM and refuses any sender that is not its supervisor; only
          # uncatchable signals get through). The failure mode this knob
          # prevents is a dark ledger: on-failure does not restart a
          # successful exit, which is how two outside SIGTERMs left one
          # dark for hours
          # (https://github.com/juspay/oss.olai/blob/main/projects/olai/RCA/2026-08-20-olai-service-sigterm.md). systemd never
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
