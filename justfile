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

# What a keystroke costs — on a generated vault, and for the newest of them in
# a real git repository. TEN of them, and each is a
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
#   - the SEARCH INDEX, timed as the thing every door that searches the
#     DIRECTORY pays per query: one query answered off the trigram table against
#     the same query answered by walking every record and every body
#     (`packages/index/src/index.bench.ts`, added with `@olai/index` — the
#     roadmap node asked for "a benchmark of body-scan cost at realistic vault
#     sizes, so adoption is a number, not a feeling"). It prints a SPREAD rather
#     than one ratio, because what an index is worth is what it throws away: a
#     rare word is answered in a fraction of a millisecond and a word in nine
#     records out of ten is declined outright, since walking is cheaper than
#     finding out. Under it are the two maintenance arms — what one write costs
#     the table, and what a query at an unmoved revision costs, which is the
#     number that has to be near zero because it is paid forever. It runs the
#     same generated vault as the three above, with PROSE added: a vault whose
#     documents are empty measures the body scan at zero, which is the one thing
#     search actually spends its milliseconds on (OLAI_BENCH_DOCS sizes it);
#   - the DAY READINGS, each timed as an index read against the corpus walk it
#     replaced (`packages/format/src/dates.bench.ts`, added with `Derived.byDay`
#     — the roadmap node `perf-dates-index` named three full-vault walks, so it
#     prints a ROW per bullet rather than one blended figure, plus what the index
#     cost the fold). Two of the three moved to the server with
#     `vault-in-browser`'s PR 4, where they are re-answered per subscriber per
#     published revision, which is the unit the ratios are about. It carries a
#     SECOND node now (`perf-agenda-history-walk`), which is why three of its
#     four rows have a middle arm: what that index left standing was the SKIP to
#     where a reading starts and the whole agenda assembled to be counted, so
#     each of those rows prints the reading as it stood BETWEEN the two nodes as
#     well as the corpus walk under both — two ratios, because they answer two
#     questions. The counts a mark outside the agenda prints are their own row
#     for the same reason: they are an index read now and not a reading of the
#     agenda, which is the whole of what that node asked for. Every arm of every
#     row must answer the same value or the run fails;
#   - `list_documents`, timed as a read of the remembered byte count against
#     the UTF-8 encode of every body it replaced
#     (`packages/ops/src/documents.bench.ts`, added with `perf-list-documents-bytes`).
#     Its own corpus — 5k `.md`, sized for a listing rather than for a
#     directory of outlines — and the two arms must answer the same listing or
#     the run fails;
#   - a SCOPED QUERY, timed as the narrowing against the corpus walk it replaced
#     (`packages/format/src/scope.bench.ts`, added with `perf-filter-scope` —
#     the roadmap node's own gate said "bench artifact", and the lane's rule is
#     that a perf number is a reported artifact and never a gate). Both arms are
#     in the tree: the "before" is the walk kept as the differential's reference
#     implementation (`@olai/format/testlib/scope`), so a reader re-running this
#     gets the pair rather than one laptop's milliseconds. It prints four
#     scopes, and the last is a CONTROL — no scope at all, which is the same
#     walk on both sides and reports as 1.0× or the run is measuring something
#     else. Beside each ratio is what the arm SELECTED, and the two arms must
#     answer the same number or the run fails: two walks answering different
#     numbers of records are two walks nobody may compare, and the one shape a
#     flattering ratio takes is a narrowing that reported magnificently by
#     answering nothing. Its vault is trees rather than the flat corpus the
#     matcher's is: a vault whose records have no parents at all is a vault
#     where `under:` holds nothing;
#   - ONE PUBLISHED REVISION, timed and COUNTED against the three walks it
#     replaced (`packages/server/src/published.bench.ts`, added with
#     `perf-published-maps`). The one leg here whose headline is not a
#     millisecond: publishing used to rebuild three maps of every served file
#     per revision, so what it reports is maps CONSTRUCTED and keys WRITTEN
#     per revision — `Map` and the `set` every map shares swapped for counting
#     ones around the call and put back after — with the wall clock beside
#     them, since allocation that cost no time would be an optimisation nobody
#     needed. THREE rows, because a collection is now carried, written into or
#     rebuilt and the three cost differently: one file saved (the commonest
#     revision there is), a file CREATED (the one shape that still rebuilds a
#     map — the row that says what this did not buy), and a `git pull` of
#     twenty. Both arms are in the tree for the scoped query's reason — the
#     "before" is the walk kept as that lane's differential reference
#     (`packages/server/src/published.testlib.ts`) — and the two are replayed
#     against each other over this leg's own corpus before a figure is quoted,
#     so a divergence throws rather than printing a ratio nobody may believe.
#     Its vault is `vaultOf` with the OTHER kinds put in beside the outlines:
#     a directory of nothing but `.olai` is one where the documents collection
#     is empty and a third of what is measured is never asked anything;
#   - ONE KEYSTROKE's COMMIT PANEL, timed and COUNTED at one, ten and fifty
#     dirty outlines (`packages/ops/src/pending.bench.ts`, added with
#     `perf-git-per-write`). The complaint that node was filed on is not that a
#     revision was slow but that the bill GREW: every published revision read
#     HEAD's copy of every dirty outline — a `git show HEAD:<file>` subprocess
#     plus a full parse, per file, per revision — and under manual commit the
#     dirty list only grows through a session, so typing got slower the longer a
#     commit was deferred. So it prints THREE ROWS rather than one figure, and
#     the shape of the "before" column down them is the bug. Its headline is not
#     a millisecond either: beside each row is git SUBPROCESSES PER KEYSTROKE for
#     the committed side, counted by wrapping the repository each arm is handed
#     rather than by instrumenting either of them — and the cache's own
#     `rev-parse` is counted like any other, so the "after" column is what it
#     costs rather than what it saved. Both arms are in the tree for the scoped
#     query's reason — the "before" is the per-file read kept as that lane's
#     differential reference (`packages/ops/src/committed.testlib.ts`) — and the
#     two are compared on every round before a figure is quoted, so a divergence
#     throws rather than printing a ratio nobody may believe. Its corpus is a
#     real git repository in a temporary directory rather than a generated
#     vault: what is being timed is subprocesses, and a fake git would measure
#     the fake. Size it with OLAI_BENCH_DIRTY / OLAI_BENCH_RECORDS /
#     OLAI_BENCH_EDITS;
#   - ONE WRITE's VALIDATION, timed as the whole-corpus rules against the
#     narrowed ones and against BOTH (`packages/format/src/validate.bench.ts`,
#     added with `perf-validate-incremental`). The third arm is the honest one
#     and the reason this leg landed with the shadow rather than after it: until
#     the flip, every write pays both validators, so what the change COSTS today
#     is printed beside what it will buy. Three rows, because the shape of the
#     edit is the whole claim — a keystroke (no cycle walk, no document walk), an
#     edge added (all three cycle walks, and the row that says what this did not
#     buy) and a `.md` deleted. The two arms must reach the same verdict or the
#     row throws, and so must a run where the narrowing DECLINED — which is the
#     same flattering ratio wearing a different face. Its vault is `vaultOf` with
#     the dangling placements taken out and `.md` files put in: a directory
#     nobody could publish is one where the narrowing declines every time, and a
#     directory holding no documents measures the `.md` walk at zero.
#
# Five of the ten run the SAME generated vault (`@olai/format/testlib`'s
# `vaultOf` — the patcher, the tag completion, the day readings and the search
# index), so what a write costs the view and what a completion, a calendar or a
# search box asks of the view it leaves are numbers about one directory; the
# matcher, the document listing and the scoped query each generate a corpus of
# their own — one sized for keystrokes, one for a vault of `.md`, one made of
# TREES — and the commit panel's is not a vault at all but a real repository in
# a temporary directory, since what it times is subprocesses. The MERGE under
# all of
# it is not timed here and should not be: it is the framework's, and
# `@kolu/surface`'s own `src/solid/collectionDeltas.bench.ts` measures it end to
# end. Size the vault with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
# OLAI_BENCH_EDITS — and turning the last one up to 900 is what makes the
# patcher's layer grow past half the id map and flatten, which it prints the
# edit of. Size the document listing with OLAI_BENCH_DOCS; the published
# revision reads OLAI_BENCH_FILES / OLAI_BENCH_RECORDS like the four above it.
bench: install
    {{ nix_shell }} bun packages/format/src/patch.bench.ts
    {{ nix_shell }} bun packages/format/src/filter.bench.ts
    {{ nix_shell }} bun packages/format/src/vocabulary.bench.ts
    {{ nix_shell }} bun packages/format/src/dates.bench.ts
    {{ nix_shell }} bun packages/format/src/scope.bench.ts
    {{ nix_shell }} bun packages/index/src/index.bench.ts
    {{ nix_shell }} bun packages/ops/src/documents.bench.ts
    {{ nix_shell }} bun packages/ops/src/pending.bench.ts
    {{ nix_shell }} bun packages/server/src/published.bench.ts
    {{ nix_shell }} bun packages/format/src/validate.bench.ts

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
