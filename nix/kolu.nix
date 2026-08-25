# The kolu workspace packages olai consumes — ONE list, everything else derived
# from it: the overlay attrs (`kolu-src-<dir>`), the flake's `packages` output,
# the argv the hydrate script takes in the dev shell, and the same argv in the
# build derivation. Adding a package is one line.
#
# No vendoring: the sources live upstream in juspay/kolu and arrive through
# the npins pin (npins/sources.json). They are consumed as raw TypeScript —
# there is no build step.
#
# A member is a DIRECTORY under kolu's `packages/` and the NAME that directory's
# manifest declares, and the two are given separately because they stopped
# agreeing when `@kolu/padi-client` arrived. The framework tier is uniformly
# `packages/<x>` → `@kolu/<x>`, and this file derived one from the other for as
# long as that was the whole list. padi-client's hydrate closure is not: its
# integrations tier lives at `packages/integrations/git` and is called
# `kolu-git`, and three more (`packages/shared` → `kolu-shared`,
# `packages/transcript-core` → `kolu-transcript-core`, `packages/nonempty` →
# `nonempty`) each disagree in their own way. A derivation rule with four
# exceptions is a rule nobody can read, so the pair is written out and the
# hydrate destination is the manifest's own name — which is what an import
# specifier resolves against, and therefore the only spelling that can be right.
#
# WHAT MUST BE ON THE LIST is not taste: it is the transitive closure of the
# `dependencies` (and `peerDependencies`) of everything already on it, because
# hydration is per-package — a consumer copies a package DIRECTORY and resolves
# that directory's declared manifest from its own root node_modules. A sibling
# nobody hydrated resolves to nothing. `scripts/check-kolu-deps.sh` walks
# exactly that and fails `just check` when the list is not closed, so this
# comment is checked rather than remembered.
let
  members = [
    # ── The framework tier: the typed reactive layer and its faces ──────────
    #
    # @kolu/surface is the typed reactive layer the product is built on.
    { dir = "surface"; name = "@kolu/surface"; }
    # @kolu/surface-app is the app shell around it: the HttpRouter layers that
    # serve the browser bundle, the websocket acceptance seam, and the Bun.build
    # helper that produces the bundle in the first place.
    { dir = "surface-app"; name = "@kolu/surface-app"; }
    # @kolu/surface-mcp is the third face on the same surface: it re-exposes a
    # declared surface as an MCP server, so an agent reads the cells and
    # collections the browser draws instead of a second projection of them. It is
    # what `/mcp` serves the READ side from — resources, with the
    # subscribe/notify lifecycle and the Effect Schema → JSON Schema bridge that
    # are the two things olai should not be writing by hand
    # (docs/brainstorming/surface-mcp-viewing.md).
    { dir = "surface-mcp"; name = "@kolu/surface-mcp"; }
    # @kolu/surface-cli is the FOURTH face on the same surface, and the one this
    # binary mounts rather than serves: it projects the declared surface as argv,
    # so `olai surface <verb>` is derived from the same spec and the same verb
    # table the MCP face reads, instead of a second hand-written client. It is
    # what retired the bespoke `POST /capture` door.
    { dir = "surface-cli"; name = "@kolu/surface-cli"; }
    { dir = "detect"; name = "@kolu/detect"; }
    # @kolu/log is the logger seam surface imports; a hydrated source resolves
    # its own imports from where it was copied, so its kolu siblings come too —
    # @kolu/url-shape is here for exactly that reason and no other: it is the
    # zero-dependency leaf `@kolu/surface-app/serve` reads its host/port
    # bracketing from, so the URL a listener reports is a URL when the host is an
    # IPv6 literal.
    { dir = "log"; name = "@kolu/log"; }
    { dir = "url-shape"; name = "@kolu/url-shape"; }

    # ── The padi contract tier (juspay/kolu#2216) ───────────────────────────
    #
    # @kolu/padi-client is padi's contract WITHOUT padi: the `padiSurface`
    # spec, the `connectPadi` dial, the rendezvous path algebra and the watch
    # kit, carved out of the daemon so a server that only wants to TALK to a
    # padi does not install one (no kaval, no node-pty, no @xterm/*). It is
    # what `@olai/orchestrator`'s mirror dials.
    { dir = "padi-client"; name = "@kolu/padi-client"; }
    # The dial's own tier: the frozen control core and the socket endpoint the
    # handshake runs over.
    { dir = "surface-daemon"; name = "@kolu/surface-daemon"; }
    { dir = "surface-daemon-supervisor"; name = "@kolu/surface-daemon-supervisor"; }
    # The records padi's surface is MADE of — terminal ids, agent info, the
    # snapshot schema, and the `agentBucket` fold the terminal door's dot is a
    # rendering of.
    { dir = "terminal-vocab"; name = "@kolu/terminal-vocab"; }
    { dir = "shell-quote"; name = "@kolu/shell-quote"; }
    { dir = "transcript-core"; name = "kolu-transcript-core"; }
    { dir = "shared"; name = "kolu-shared"; }
    { dir = "nonempty"; name = "nonempty"; }
    { dir = "memorable-names"; name = "memorable-names"; }
    # The integrations tier — the agent-detection and forge/git schema leaves
    # `@kolu/terminal-vocab` and padi's per-terminal sensor declare. They are
    # parse-and-schema packages: what `agent` and `pr` and `git` are shaped like
    # on a terminal record.
    { dir = "integrations/anyagent"; name = "anyagent"; }
    { dir = "integrations/anyforge"; name = "anyforge"; }
    { dir = "integrations/claude-code"; name = "kolu-claude-code"; }
    { dir = "integrations/codex"; name = "kolu-codex"; }
    { dir = "integrations/git"; name = "kolu-git"; }
    { dir = "integrations/github"; name = "kolu-github"; }
    { dir = "integrations/grok"; name = "kolu-grok"; }
    { dir = "integrations/io"; name = "kolu-io"; }
    { dir = "integrations/opencode"; name = "kolu-opencode"; }
    { dir = "integrations/pi"; name = "kolu-pi"; }
    { dir = "integrations/pty"; name = "kolu-pty"; }
  ];

  # The overlay attr for a member — `kolu-src-integrations-git`. Derived from
  # the DIRECTORY rather than the package name because a nix attr may not hold
  # a `/` or a `@`, and the directory is the thing being copied.
  attrOf = member: "kolu-src-" + builtins.replaceStrings [ "/" ] [ "-" ] member.dir;

  pairs = pkgs: builtins.concatMap
    (member: [ "${pkgs.${attrOf member}}" member.name ])
    members;
in
{
  inherit members;

  overlay = final: _prev: builtins.listToAttrs (map
    (member: {
      name = attrOf member;
      value = final.runCommand (attrOf member)
        {
          meta = {
            description = "${member.name} source extracted from juspay/kolu";
            homepage = "https://github.com/juspay/kolu";
          };
        }
        "cp -r ${(import ../npins).kolu}/packages/${member.dir} $out";
    })
    members);

  # `sh scripts/hydrate-kolu-packages.sh $OLAI_KOLU_HYDRATE` — the script takes
  # <src> <dest> pairs, so the env carries the whole argv. One variable per
  # package would make every caller re-list the set.
  hydrateArgs = pkgs: builtins.concatStringsSep " " (pairs pkgs);

  # The same sources as bare directories, for scripts/check-kolu-deps.sh.
  sourceDirs = pkgs: builtins.concatStringsSep " "
    (map (member: "${pkgs.${attrOf member}}") members);

  # Realizable store paths: `nix build .#kolu-src-surface` gets you the exact
  # tree the hydrate script copies.
  packages = pkgs: builtins.listToAttrs (map
    (member: { name = attrOf member; value = pkgs.${attrOf member}; })
    members);
}
