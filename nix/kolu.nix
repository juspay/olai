# The vendored TypeScript sources olai consumes — ONE list, everything else
# derived from it: the overlay attrs (`kolu-src-<dir>`), the flake's `packages`
# output, the argv the hydrate script takes in the dev shell, and the same argv
# in the build derivation. Adding a package is one line.
#
# No vendoring into git: the sources live upstream and arrive through the npins
# pins (npins/sources.json). They are consumed as raw TypeScript — there is no
# build step, which is also why every one of them is compiled by olai's own
# `tsc` and why a source that will not typecheck here is a blocker rather than a
# nuisance.
#
# A member is a SOURCE ROOT, a DIRECTORY under it, and the NAME that directory's
# manifest declares. All three are given separately because they stopped
# agreeing when `@kolu/padi-client` arrived:
#
#   - the framework tier is uniformly `kolu:packages/<x>` → `@kolu/<x>`, and
#     this file derived one from the other for as long as that was the list;
#   - padi-client's hydrate closure is not — its integrations tier lives at
#     `packages/integrations/git` and is called `kolu-git`, and three more
#     (`packages/shared` → `kolu-shared`, `packages/transcript-core` →
#     `kolu-transcript-core`, `packages/nonempty` → `nonempty`) each disagree in
#     their own way;
#   - and `osfacts-client` is not in the kolu repository at all (see below).
#
# A derivation rule with five exceptions is a rule nobody can read, so the
# triple is written out and the hydrate destination is the manifest's own name —
# which is what an import specifier resolves against, and therefore the only
# spelling that can be right.
#
# WHAT MUST BE ON THE LIST is not taste: it is the transitive closure of the
# `dependencies` (and `peerDependencies`) of everything already on it, because
# hydration is per-package — a consumer copies a package DIRECTORY and resolves
# that directory's declared manifest from its own root node_modules. A sibling
# nobody hydrated resolves to nothing. `scripts/check-kolu-deps.sh` walks
# exactly that and fails `just check` when the list is not closed, so this
# comment is checked rather than remembered.
let
  npins = import ../npins;

  members = [
    # ── The framework tier: the typed reactive layer and its faces ──────────
    #
    # @kolu/surface is the typed reactive layer the product is built on.
    { src = npins.kolu; dir = "packages/surface"; name = "@kolu/surface"; }
    # @kolu/surface-app is the app shell around it: the HttpRouter layers that
    # serve the browser bundle, the websocket acceptance seam, and the Bun.build
    # helper that produces the bundle in the first place.
    { src = npins.kolu; dir = "packages/surface-app"; name = "@kolu/surface-app"; }
    # @kolu/surface-mcp is the third face on the same surface: it re-exposes a
    # declared surface as an MCP server, so an agent reads the cells and
    # collections the browser draws instead of a second projection of them. It is
    # what `/mcp` serves the READ side from — resources, with the
    # subscribe/notify lifecycle and the Effect Schema → JSON Schema bridge that
    # are the two things olai should not be writing by hand
    # (docs/brainstorming/surface-mcp-viewing.md).
    { src = npins.kolu; dir = "packages/surface-mcp"; name = "@kolu/surface-mcp"; }
    # @kolu/surface-cli is the FOURTH face on the same surface, and the one this
    # binary mounts rather than serves: it projects the declared surface as argv,
    # so `olai surface <verb>` is derived from the same spec and the same verb
    # table the MCP face reads, instead of a second hand-written client. It is
    # what retired the bespoke `POST /capture` door.
    { src = npins.kolu; dir = "packages/surface-cli"; name = "@kolu/surface-cli"; }
    { src = npins.kolu; dir = "packages/detect"; name = "@kolu/detect"; }
    # @kolu/log is the logger seam surface imports; a hydrated source resolves
    # its own imports from where it was copied, so its kolu siblings come too —
    # @kolu/url-shape is here for exactly that reason and no other: it is the
    # zero-dependency leaf `@kolu/surface-app/serve` reads its host/port
    # bracketing from, so the URL a listener reports is a URL when the host is an
    # IPv6 literal.
    { src = npins.kolu; dir = "packages/log"; name = "@kolu/log"; }
    { src = npins.kolu; dir = "packages/url-shape"; name = "@kolu/url-shape"; }

    # ── The Dock row tier (juspay/kolu#2217) ────────────────────────────────
    #
    # @kolu/solid-dockrow is kolu's Dock terminal row, whole — the row olai
    # DRAWS beside a `terminal` property, rather than a second row olai draws
    # instead. It is the reason this tier exists: the fifth Löwy sitting ruled
    # that olai's homegrown face vocabulary dies and kolu's row replaces it, so
    # what you see beside a node is literally what you would see in the Dock.
    #
    # It arrives as JSX rather than as a built bundle, like everything else
    # here, so olai's own Solid transform and olai's own Tailwind pass compile
    # it — which is what makes the row olai draws and the row kolu draws the
    # same source rather than two builds of it.
    { src = npins.kolu; dir = "packages/solid-dockrow"; name = "@kolu/solid-dockrow"; }
    # The pip inside the row — extracted first (the statepip precedent the row
    # names), and the home of the pip trio's own vocabulary and guards.
    { src = npins.kolu; dir = "packages/solid-statepip"; name = "@kolu/solid-statepip"; }
    # The tokens both stylesheets resolve their colours against. A stylesheet
    # and nothing else: no manifest dependencies, no source.
    { src = npins.kolu; dir = "packages/theme"; name = "@kolu/theme"; }
    # The terminal THEMES a pane paints with — kolu's own catalog, parsed from
    # iTerm2-Color-Schemes and checked in beside the code. A padi record carries
    # the `themeName` its terminal was created with, so olai's live pane renders
    # a terminal exactly as kolu renders it rather than in xterm's washed-out
    # default (the human, on the first live look).
    { src = npins.kolu; dir = "packages/terminal-themes"; name = "terminal-themes"; }

    # ── The padi contract tier (juspay/kolu#2216) ───────────────────────────
    #
    # @kolu/padi-client is padi's contract WITHOUT padi: the `padiSurface`
    # spec, the `connectPadi` dial, the rendezvous path algebra and the watch
    # kit, carved out of the daemon so a server that only wants to TALK to a
    # padi does not install one (no kaval, no node-pty, no @xterm/*). It is
    # what `@olai/kolu-client`'s mirror dials.
    { src = npins.kolu; dir = "packages/padi-client"; name = "@kolu/padi-client"; }
    # The dial's own tier: the frozen control core and the socket endpoint the
    # handshake runs over. Both are reached through their BARE barrels, which
    # value-re-export the daemon runtime — kolu records that as the known cost
    # of `connectPadi` (`hydrate.closure.test.ts`'s recorded barrels) and would
    # close it with leaf entries on both packages, which is drishti-gated. Two
    # consequences land here rather than there: `types/bun-process-signals.d.ts`
    # exists so the daemon's teardown compiles, and `osfacts-client` below is
    # required at all.
    { src = npins.kolu; dir = "packages/surface-daemon"; name = "@kolu/surface-daemon"; }
    { src = npins.kolu; dir = "packages/surface-daemon-supervisor"; name = "@kolu/surface-daemon-supervisor"; }
    # The records padi's surface is MADE of — terminal ids, agent info, the
    # snapshot schema, and the `agentBucket` fold the terminal door's dot is a
    # rendering of.
    { src = npins.kolu; dir = "packages/terminal-vocab"; name = "@kolu/terminal-vocab"; }
    { src = npins.kolu; dir = "packages/shell-quote"; name = "@kolu/shell-quote"; }
    { src = npins.kolu; dir = "packages/transcript-core"; name = "kolu-transcript-core"; }
    { src = npins.kolu; dir = "packages/shared"; name = "kolu-shared"; }
    { src = npins.kolu; dir = "packages/nonempty"; name = "nonempty"; }
    { src = npins.kolu; dir = "packages/memorable-names"; name = "memorable-names"; }
    # The integrations tier — the agent-detection and forge/git schema leaves
    # `@kolu/terminal-vocab` and padi's per-terminal sensor declare. They are
    # parse-and-schema packages: what `agent` and `pr` and `git` are shaped like
    # on a terminal record.
    { src = npins.kolu; dir = "packages/integrations/anyagent"; name = "anyagent"; }
    { src = npins.kolu; dir = "packages/integrations/anyforge"; name = "anyforge"; }
    { src = npins.kolu; dir = "packages/integrations/claude-code"; name = "kolu-claude-code"; }
    { src = npins.kolu; dir = "packages/integrations/codex"; name = "kolu-codex"; }
    { src = npins.kolu; dir = "packages/integrations/git"; name = "kolu-git"; }
    { src = npins.kolu; dir = "packages/integrations/github"; name = "kolu-github"; }
    { src = npins.kolu; dir = "packages/integrations/grok"; name = "kolu-grok"; }
    { src = npins.kolu; dir = "packages/integrations/io"; name = "kolu-io"; }
    { src = npins.kolu; dir = "packages/integrations/opencode"; name = "kolu-opencode"; }
    { src = npins.kolu; dir = "packages/integrations/pi"; name = "kolu-pi"; }
    { src = npins.kolu; dir = "packages/integrations/pty"; name = "kolu-pty"; }

    # ── The second pin ──────────────────────────────────────────────────────
    #
    # `osfacts-client` is the one member that does not come from kolu, and it is
    # the only reason this file grew a `src` field. `@kolu/surface-daemon-
    # supervisor` — which `@kolu/padi-client/dial` reaches for `dialSocket` and
    # the skew error — states its `ReadSocketHolders` seam in this package's
    # vocabulary, deliberately: the success half and the three failure tags have
    # one provenance, and a local copy would be a second name for facts it does
    # not produce. It is that package's PUBLIC API.
    #
    # kolu grafts it into its own tree from an npins pin and gitignores it, so
    # it is absent from the archive we vendor — three `import type` sites, which
    # a raw-TypeScript consumer's `tsc` resolves like any other import and fails
    # TS2307 without. So olai pins `juspay/osfacts` too, at THE REVISION KOLU
    # PINS, and grafts the same directory (kolu's `padi-client/README.md`, "The
    # second pin"; drishti's `nix/overlay.nix` is the older precedent).
    #
    # RE-PINNING KOLU MEANS CHECKING THIS ONE: the two revisions are a pair, and
    # nothing mechanical holds them together — kolu's own npins is the source of
    # truth, and `scripts/check-osfacts-pin.sh` reads it and fails `just check`
    # when the two have drifted, so the pairing is checked rather than kept by
    # hand. The package is pure TypeScript over `effect`; the Rust binary beside
    # it in that repo is the daemon's business, not ours.
    { src = npins.osfacts; dir = "client-ts"; name = "osfacts-client"; }
  ];

  # The overlay attr for a member — `kolu-src-integrations-git`. Derived from
  # the DIRECTORY rather than the package name because a nix attr may not hold
  # a `/` or a `@`, and the directory is the thing being copied.
  attrOf = member:
    "kolu-src-" + builtins.replaceStrings [ "/" ] [ "-" ]
      (builtins.replaceStrings [ "packages/" ] [ "" ] member.dir);

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
            description = "${member.name} source extracted from its upstream pin";
            homepage = "https://github.com/juspay/kolu";
          };
        }
        "cp -r ${member.src}/${member.dir} $out";
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
