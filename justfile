# olai developer recipes.
#
# `just check` is the gate AND the CI pipeline: it carries the
# [metadata("ci")] tag, so odu (github.com/juspay/odu) discovers it, expands
# its dependency subgraph, and fans every (recipe × platform) pair out as a
# node it runs with `just --no-deps <recipe>`. There is no GitHub Actions
# workflow and no separate CI justfile — one list of legs, run the same way on
# a laptop and on a lane, and no second graph to keep in sync with this one.

# Re-enter the flake devShell unless already inside one. nix resolves a path
# inside a git work tree to a `git+file://` flakeref, which keeps its eval
# cache warm — and means only *tracked* files are visible, so a new .nix file
# must be `git add`ed before `nix develop` sees it.
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + justfile_directory() + ' --accept-flake-config -c' }

# The *.nix files this repo owns — all of them. Generated files are normalized
# by the recipe that generates them (`regenerate-bun-nix`, `update-pins`),
# never exempted here. `git ls-files` rather than `.` so node_modules and
# .direnv stay out.
nix_files := "$(git ls-files '*.nix')"

# Where `just build-client` writes the browser bundle, and the one place the
# server is told to look (OLAI_DIST_DIR). Generated, gitignored; the nix build
# writes its own copy inside its sandbox.
dist := justfile_directory() + "/packages/web/dist"

# Where this worktree's `just run` / `just serve` write the URL they actually
# bound. Per-worktree on purpose: `/tmp/olai-dev` is a path every checkout
# shares, and two e2e lanes used to dial one tree through it. The server
# reads the same file back when the next process asks for port 0 (a
# `bun --watch` restart, or a later `just run`); `.mcp.json` names
# production (7714), not this.
dev_url := justfile_directory() + "/.olai-dev/url"

# The e2e shell is the dev shell plus Playwright's browsers, which cost ~600ms
# of cold `nix develop` that every other leg would pay for nothing. Keyed on
# PLAYWRIGHT_BROWSERS_PATH rather than IN_NIX_SHELL: the default shell sets
# IN_NIX_SHELL and does NOT provide browsers, so a leg running inside it must
# still enter `.#e2e` to get them.
nix_shell_e2e := if env('PLAYWRIGHT_BROWSERS_PATH', '') != '' { '' } else { 'nix develop ' + justfile_directory() + '#e2e --accept-flake-config -c' }

# List available recipes
default:
    @just --list

# The gate, and the CI pipeline. Bodyless on purpose: odu runs each dependency
# as its own node, so anything written here would run nowhere.
[linux]
[macos]
[parallel]
[metadata("ci")]
check: typecheck test e2e kolu-deps fmt-check nix bun-nix-fresh hm-module

# Install deps (bun) and hydrate the @kolu/* sources from the npins kolu pin.
# Every bun leg depends on this one recipe, so concurrent legs share a single
# install rather than racing on node_modules.
#
# The hydrate call is wrapped in `sh -c '...'` so $OLAI_KOLU_HYDRATE expands
# inside the dev shell that exports it, not in just's own shell (which runs
# under `set -u`). It is a whole argv — nix/kolu.nix derives it from one list
# — so the expansion is deliberately unquoted.
install:
    {{ nix_shell }} sh -c 'bun install --frozen-lockfile \
      && sh scripts/hydrate-kolu-packages.sh $OLAI_KOLU_HYDRATE'

# TypeScript type checking — every workspace member, from the glob bun
# installs from
typecheck: install
    {{ nix_shell }} bun run typecheck

# Unit tests. TWO commands, one leg — and the second is not a second suite.
#
# `bun test` resolves SolidJS's SERVER build, where a memo never re-runs,
# `createResource` throws outright, an EFFECT never runs at all and `isServer`
# is true (which is what `@solid-primitives/scheduled` reads to turn `debounce`
# into a function that does nothing). That is fine for nearly everything (the
# packages that are not the browser want that resolution, and most of the
# client's own Solid tests stick to signals and memos), and it is why the tab's
# bench asks for `--conditions browser` explicitly. But a rule whose whole
# subject is reactive cannot be asked under it — and worse than failing, it
# PASSES, having run none of the code it names. Two are: `settled.ts`, the asker
# every shortlist door in the client is built on, and `fold/refiling.ts`, which
# decides when this browser asks where its folded ids now live and how many
# times an answer may be applied. So their cases run under the browser
# condition, here, where they fail this leg like any other test rather than
# living in a lane nobody runs.
#
# The FILENAME is what keeps the two runs apart: bun discovers `.test.` /
# `_test_` / `.spec.` / `_spec_` and nothing else, so a `.browsertest.ts` is
# invisible to the first command and named as a path by the second. Running the
# WHOLE suite under the browser condition is not the alternative — it fails 59
# tests in packages that legitimately resolve the other way.
#
# The list grew with `reactivity-after-the-flip`, whose subjects are memos and
# effects over a store — and "a memo re-ran" is the very claim a server-resolved
# run cannot make, so each of these would PASS having recomputed nothing.
# `names.ts` is the table every title resolver reads (PR 2), `Tree.tsx` is what
# one frame costs every row of the page (PR 6, over the real store merge),
# `directory.ts`'s broken map has to hold its identity across a frame,
# `chat/last.ts` is about which rows an effect subscribes to (PR 4),
# `chat/attention/asked.ts` is the same claim one row-kind over and gets its
# own case because the answer differs — an ask row SETTLES under a key that
# never moves, so membership alone is not enough — `chat/attention/elsewhere.ts`
# is TWO DOCUMENTS and a bit that decays, which has no single-document shape at
# all and whose decay is a signal a timer flips, and
# `chat/declared.ts` is an ASKING that is an effect, over a failure slot every
# message on screen shares (PR 5). `commit/auto.ts` was here too — a TIMER armed
# and disarmed by an effect, which a server-resolved run would report as minting
# one commit having minted none — and it is gone with the loop: the quiet window
# is the server's now (`@olai/ops`' `loop.ts`), so what used to need a browser
# resolution is an ordinary unit test one package down.
test: install
    {{ nix_shell }} bun test
    {{ nix_shell }} bun test --conditions browser \
      ./packages/web/src/client/settled.browsertest.ts \
      ./packages/web/src/client/fold/refiling.browsertest.ts \
      ./packages/web/src/client/names.browsertest.ts \
      ./packages/web/src/client/Tree.browsertest.ts \
      ./packages/web/src/client/directory.browsertest.ts \
      ./packages/web/src/client/chat/last.browsertest.ts \
      ./packages/web/src/client/chat/attention/asked.browsertest.ts \
      ./packages/web/src/client/chat/attention/elsewhere.browsertest.ts \
      ./packages/web/src/client/chat/declared.browsertest.ts

# Every dependency the hydrated @kolu/* sources declare, checked against the
# root package.json (bunfig.toml explains why they have to be there). Reads
# the pinned sources in the store and this repo's manifests, never
# node_modules — so it does not wait on `install` and fails fast.
kolu-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-kolu-deps.sh $OLAI_KOLU_DIRS'

# Build the browser bundle into packages/web/dist. The nix build runs this
# same script in its own sandbox (default.nix), so there is one bundler and not
# two that could drift.
build-client: install
    {{ nix_shell }} bun packages/web/src/build.ts {{ dist }}

# Serve a directory from the working tree — the edit loop, and it WATCHES.
# Two `bun --watch` processes in one shell: the bundler re-runs when anything
# under packages/web/src changes, and the server restarts when anything it
# imports does. Edit a validator rule and reload the tab; there is no build step
# to remember, which is the whole reason this recipe is not just `bun main.ts`.
#
# The client's watcher rebuilds into the same dist the server is serving, so a
# browser reload picks up client edits too. Note the two watchers are different
# things: this one watches the SOURCE and restarts the process, while the served
# directory's outlines are watched by the running server itself and reach the
# open page with no reload at all.
#
# Defaults to docs/, which is itself an outline set (docs/roadmap.olai), so
# `just serve` with no arguments shows this project's own plan. `just nix` is
# the other path: the packaged binary, built from tracked files only. Use this
# one while working; that one is what CI proves.
serve dir="docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    # The chat panel defaults to the pinned Claude Code adapter, exactly as the
    # packaged binary does — scripts/acp-agent.sh is the one place that is
    # decided, and `OLAI_ACP_AGENT` overrides it (empty disables).
    export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
    # `kill 0` takes the whole process group down together: a stray bundler
    # watching a tree nobody is serving is a confusing thing to leave behind.
    trap 'kill 0' EXIT INT TERM
    {{ nix_shell }} bun --watch packages/web/src/build.ts {{ dist }} &
    OLAI_DIST_DIR={{ dist }} OLAI_PORT_FILE={{ dev_url }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} {{ args }}

# The one brain: `olai web` on this repo's docs, on an OS-assigned port.
# Distinct from `serve`: that one is the web edit loop (client bundler
# watch + server watch); this one watches only the server. Extra args after
# the directory reach the binary (`--commit=manual`, `--host`, …). Defaults
# to the same pinned agent `just serve` and the packaged binary do: no
# documented way of starting olai may land in the no-agent state by accident.
# The bound URL is written to `.olai-dev/url` (see `dev_url`); a fixed
# `--port` is a deploy's word, not this recipe's.
run dir="docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
    OLAI_DIST_DIR={{ dist }} OLAI_PORT_FILE={{ dev_url }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} {{ args }}

# Build the binary with nix, then run it. Both halves earn their place: the
# build is where the hydrated @kolu/* sources and the bun.nix-derived
# node_modules meet outside the dev shell, and running it is what proves that
# tree's module graph resolves — a typecheck cannot, because the dev tree has
# packages the build's does not. The run re-uses the build's output (it
# re-evaluates the flake, which is cheap and warm). No nix_shell prefix: this
# recipe IS the outside-the-shell check.
nix:
    #!/usr/bin/env bash
    set -euo pipefail
    out=$(nix build .#olai --no-link --print-out-paths --accept-flake-config)
    nix run .#olai --accept-flake-config -- --help > /dev/null
    # The packaged DEFAULT AGENT, as a checked fact rather than a claim in a
    # doc: `nix run` has to come with the pinned Claude Code adapter, so the
    # wrapper must carry it and the thing it names must be runnable. Dropping
    # the `--set-default` in default.nix, or renaming the flake attribute it
    # points at, fails here rather than as a "no ACP agent" message in
    # somebody's browser.
    #
    # The one-dash `${VAR-...}` is asserted too, and it is load-bearing: it
    # substitutes only when the variable is UNSET, which is what makes an empty
    # OLAI_ACP_AGENT the explicit off switch instead of a fall-through to the
    # default.
    agent=$(sed -n "s|.*OLAI_ACP_AGENT=\${OLAI_ACP_AGENT-'\(.*\)'}.*|\1|p" "$out/bin/olai")
    if [ -z "$agent" ]; then
      echo "the packaged binary does not bake OLAI_ACP_AGENT into its wrapper," >&2
      echo "so \`nix run\` would start with no agent — every documented launch" >&2
      echo "path is supposed to default to the pinned adapter. Wrapper:" >&2
      cat "$out/bin/olai" >&2
      exit 1
    fi
    if [ ! -x "$agent" ]; then
      echo "the wrapper's baked OLAI_ACP_AGENT is not executable: $agent" >&2
      exit 1
    fi
    echo "packaged default agent: $agent"

# The home-manager module evaluates under a sample config (systemd argv on
# Linux, launchd argv on Darwin). Cheap, no home-manager pin, no activation —
# just the option shape and the service knobs. See nix/home/check.nix.
hm-module:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).hm-module --no-link --accept-flake-config

# What a keystroke costs, on a generated vault. FIVE of them, and each is a
# LEG rather than a scratch file, because slice 3 of `model-indices` ran its
# numbers as a one-off and a benchmark nobody can re-run is a number nobody can
# check — and deliberately NOT a dependency of `check`, since a timing that
# fails a lane on a busy machine teaches nobody anything.
#
# THE FIFTH WAS THE TAB's own frame, and it is gone with what it timed: it
# measured what a browser paid between a `deltas` frame of the whole set landing
# and having a view of the directory again, and a browser holds no view of the
# directory any more (`docs/brainstorming/vault-in-browser.md`'s PR 10). What
# replaced it is not a timing at all but a WIRE measurement, which is the thing
# that actually changed — `packages/tests/wire.ts`'s `pages` session, run
# against two worktrees with `wire.sh`'s `ROOT=`.
#
#   - the PATCHER under every view — `derive` over the whole corpus, against
#     `patched` on the view the last edit left, against that same patch paying
#     the id-map clone the overlay replaced
#     (`packages/format/src/patch.bench.ts`). It is the harness slice 3
#     measured its order-of-magnitude figure with and did not commit, which is
#     why architecture.md called that number one this tree could not reproduce,
#     and the third arm is there so the overlay's own before/after is printed
#     rather than quoted;
#   - the MATCHER, timed with the fold it keeps per record against without it —
#     what the filter over a page and the chat composer's `@` list each pay per
#     keystroke (`packages/format/src/filter.bench.ts`, added when a reviewer
#     asked where the milliseconds in its header came from);
#   - the TAG COMPLETION, timed as an index read against the corpus walk it
#     replaced (`packages/format/src/vocabulary.bench.ts`, added with
#     `taggedBy` — the roadmap deferred that index until somebody measured this
#     walk, so the measurement is a leg rather than a paragraph). It moved down
#     from the browser with the reading it times, which the server now runs per
#     settled keystroke instead of the tab running it per frame. Its two arms
#     must answer the same list or the run fails, and a third times the walk as
#     it literally stood; what the wider index costs the FOLD, and what the tag
#     WALK under it costs in the three shapes it has been written in, are the
#     two pairs the first leg prints at the end;
#   - the DAY READINGS, each timed as an index read against the corpus walk it
#     replaced (`packages/format/src/dates.bench.ts`, added with `Derived.byDay`
#     — the roadmap node `perf-dates-index` named three full-vault walks, so it
#     prints three PAIRS rather than one blended figure, plus what the index
#     cost the fold). Two of the three moved to the server with
#     `vault-in-browser`'s PR 4, where they are re-answered per subscriber per
#     published revision, which is the unit the ratios are about. Each pair must
#     answer the same value or the run fails.
#   - `list_documents`, timed as a read of the remembered byte count against
#     the UTF-8 encode of every body it replaced
#     (`packages/ops/src/documents.bench.ts`, added with `perf-list-documents-bytes`).
#     Its own corpus — 5k `.md`, sized for a listing rather than for a
#     directory of outlines — and the two arms must answer the same listing or
#     the run fails.
#
# Three of the five run the SAME generated vault (`@olai/format/testlib`'s
# `vaultOf` — the patcher, the tag completion and the day readings), so what a
# write costs the view and what a completion or a calendar asks of the view it
# leaves are numbers about one directory; the
# matcher generates a corpus of its own, sized for keystrokes rather than for a
# directory, and the document listing another, sized for a vault of `.md`. The
# MERGE under all of
# it is not timed here and should not be: it is the framework's, and
# `@kolu/surface`'s own `src/solid/collectionDeltas.bench.ts` measures it end to
# end. Size the vault with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
# OLAI_BENCH_EDITS — and turning the last one up to 900 is what makes the
# patcher's layer grow past half the id map and flatten, which it prints the
# edit of. Size the document listing with OLAI_BENCH_DOCS.
bench: install
    {{ nix_shell }} bun packages/format/src/patch.bench.ts
    {{ nix_shell }} bun packages/format/src/filter.bench.ts
    {{ nix_shell }} bun packages/format/src/vocabulary.bench.ts
    {{ nix_shell }} bun packages/format/src/dates.bench.ts
    {{ nix_shell }} bun packages/ops/src/documents.bench.ts

# A worktree-local wrapper the e2e harness can spawn (`OLAI_BIN=` this)
# instead of the nix-built binary. `/tmp/olai-dev` is how two worktrees
# used to drive one tree; this file lives in THIS worktree.
dev-bin:
    #!/usr/bin/env bash
    set -euo pipefail
    dir="{{ justfile_directory() }}/.olai-dev"
    mkdir -p "$dir"
    printf '#!/usr/bin/env bash\nexec bun %s/packages/server/src/main.ts "$@"\n' \
      "{{ justfile_directory() }}" > "$dir/bin"
    chmod +x "$dir/bin"
    echo "$dir/bin"

# The browser tests: Cucumber features driven through Playwright against the
# nix-built binary, which is what a user actually runs. `nix` is a dependency
# as well as the shell so the binary is an already-realised lookup here rather
# than a Nix build racing the one that leg is doing.
e2e: install nix
    #!/usr/bin/env bash
    set -euo pipefail
    bin="$(nix build .#olai --no-link --print-out-paths --accept-flake-config)/bin/olai"
    cd packages/tests
    # `cd` rather than `bun --cwd`: with --cwd, bun swallows the script name and
    # prints its own help with status 0, which reads as a passing leg that ran
    # no tests at all.
    OLAI_BIN="$bin" {{ nix_shell_e2e }} bun run test

# Format the *.nix files
fmt:
    {{ nix_shell }} nixpkgs-fmt {{ nix_files }}

# Check formatting without modifying
fmt-check:
    {{ nix_shell }} nixpkgs-fmt --check {{ nix_files }}

# One spelling of "derive bun.nix from bun.lock", so the freshness check below
# and the regeneration cannot drift apart.
[private]
_gen-bun-nix out:
    {{ nix_shell }} sh -c 'nix run .#bun2nix --accept-flake-config -- -l bun.lock -o "{{ out }}" && nixpkgs-fmt "{{ out }}"'

# Regenerate bun.nix from bun.lock. Run after any `bun install` / `bun add`.
regenerate-bun-nix: (_gen-bun-nix "bun.nix")

# bun.nix drives the nix build's dependency fetch and is generated from
# bun.lock, so a lockfile change without a regen makes `nix build` install a
# different tree than `bun install` does — silently. It generates into a
# tmpdir rather than in place because `check` runs its legs in parallel, and a
# leg that rewrote a tracked file would race the ones reading it.
bun-nix-fresh:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    just _gen-bun-nix "$tmp/bun.nix"
    diff -u bun.nix "$tmp/bun.nix" || {
      echo
      echo "bun.nix is stale relative to bun.lock."
      echo "Run: just regenerate-bun-nix && git add bun.nix"
      exit 1
    }

# Update the kolu / nixpkgs / nixpkgs-bun pins. npins rewrites
# npins/default.nix in its own formatter's style, so normalize it here —
# same rule as bun.nix, and the reason fmt-check needs no exception list.
# `just check` then names anything the new kolu revision expects that this
# repo has not moved with it. nixpkgs-bun tracks NixOS/nixpkgs#556047 on
# `hesprs/nixpkgs` (`bun-1.4-update`); a bare update follows that branch
# and cannot drop the bun bump. Drop the pin (and the overlay in
# nix/nixpkgs.nix) when the PR merges — bun-nixpkgs-catchup.
update-pins:
    {{ nix_shell }} sh -c 'npins update && nixpkgs-fmt npins/default.nix'
