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
check: typecheck test e2e kolu-deps odu-deps cordis-deps fmt-check nix bun-nix-fresh hm-module

# Install deps (bun) and hydrate the @kolu/* sources from the npins kolu pin.
# The `npm ci` in the acp/ pin is the adapter tree's half: the MCP bridge's
# tests (packages/plugins/pi/acp/mcp-bridge) resolve the SDK from ITS lockfile, not the root's
# bun one — and `bun test` discovers them with everything else, so a fresh
# machine's first `just test` needs both trees standing. It is the same
# lockfile the FOD builds from; nothing here drifts.
# `npm ci` is announced on stderr before it starts, then run with
# `--loglevel=http`: `nix develop -c` is not a TTY, so npm turns progress
# off and notice-level is silent until "added N packages in 5m" — a cold
# fetch of the adapter tree is the wait `just run` used to look hung on.
# `--no-audit --no-fund` drop a second registry round-trip that is not
# the lockfile.
# Every bun leg depends on this one recipe, so concurrent legs share a single
# install rather than racing on node_modules.
#
# The hydrate call is wrapped in `sh -c '...'` so $OLAI_KOLU_HYDRATE expands
# inside the dev shell that exports it, not in just's own shell (which runs
# under `set -u`). It is a whole argv — nix/kolu.nix derives it from one list
# — so the expansion is deliberately unquoted.
#
# `@odu/run-client` rides the SAME script on a second line — one copier, two
# pins (nix/odu.nix says why odu brings no script of its own). Cordis is a
# third pin on a third line, four packages out of one repository
# (nix/cordis.nix). Separate invocations rather than one concatenated argv so
# a failure names which pin it was hydrating.
#
# The LAST lines are the same errand for an ASSET rather than for sources:
# each tenant's own logo, already turned into a TypeScript module by
# `packages/plugin-kit/default.nix` out of that tenant's pin, copied beside
# the component that draws it. So this recipe now does deps, hydrate AND
# assets, and every one of them comes from a pin. `install -m 644` rather
# than `cp`: the source is a 0444 store path, and `install` unlinks and
# recreates, so the next run can overwrite its own output without a second
# `chmod`.
install:
    {{ nix_shell }} sh -c 'bun install --frozen-lockfile \
      && echo >&2 "cd acp && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund" \
      && (cd acp && npm ci --ignore-scripts --loglevel=http --progress=false --no-audit --no-fund) \
      && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_KOLU_HYDRATE \
      && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_ODU_HYDRATE \
      && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_CORDIS_HYDRATE \
      && bun packages/bundle/generate.ts \
      && install -m 644 "$OLAI_KOLU_MARK_DIR/mark.generated.ts" packages/plugins/kolu/src/browser/mark.generated.ts \
      && install -m 644 "$OLAI_ODU_MARK_DIR/mark.generated.ts" packages/plugins/odu/src/browser/mark.generated.ts'

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
# `names.ts` is the table every title resolver reads (PR 2), `doors.ts` is
# its twin one question over — what the property values a page draws NAME, which
# every chip of every row looks up — and `licences.ts` is the third of them:
# which of those values a running plugin's contributed KIND claims, which is what
# a live face is looked up by and is the more expensive one to re-run for
# nothing (a terminal door's whole subscription, not a chip's text) —
# `Tree.tsx` is what
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
      ./packages/web/src/client/doors.browsertest.ts \
      ./packages/web/src/client/licences.browsertest.ts \
      ./packages/web/src/client/Tree.browsertest.ts \
      ./packages/web/src/client/directory.browsertest.ts \
      ./packages/web/src/client/chat/last.browsertest.ts \
      ./packages/web/src/client/chat/attention/asked.browsertest.ts \
      ./packages/web/src/client/chat/attention/elsewhere.browsertest.ts \
      ./packages/web/src/client/chat/declared.browsertest.ts \
      ./packages/plugins/kolu/src/appliance/props/held.browsertest.ts

# The same suite, TO A LOG — for an agent, or for anyone who wants to read the
# failures more than once.
#
# NEVER PIPE A LONG RUN THROUGH `tail` OR `head`. A truncated run throws away
# the very lines you needed, so the next thing you do is run it AGAIN to see
# them — which on this suite is two minutes bought for nothing. Redirect ONCE
# and interrogate the file as many times as you like:
#
#     just test-log
#     grep -E '^\(fail\)' .test.log          # which cases failed
#     grep -B 20 '^(fail)' .test.log         # ...and why
#     grep -E '^ +[0-9]+ (pass|fail)' .test.log
#
# Same rule for `just typecheck` and `just e2e`: `> some.log 2>&1`, then grep.
#
# The log is gitignored and overwritten per run. It is deliberately NOT `| tee`:
# a tee still floods the terminal (and an agent's context) with the passing
# lines, and the passing lines are never what anybody came for.

# The unit suite to .test.log, printing only the failures — never pipe a long run through tail/head
test-log:
    #!/usr/bin/env bash
    set -uo pipefail
    {{ nix_shell }} bun test > .test.log 2>&1
    status=$?
    grep -E '^\(fail\)|^ +[0-9]+ (pass|fail)' .test.log || true
    echo "full output: .test.log"
    exit $status

# Every dependency the hydrated @kolu/* sources declare, checked against the
# root package.json, every workspace manifest and the root `overrides` block
# (bunfig.toml explains why they have to be there). Reads the pinned sources in
# the store and this repo's manifests, never node_modules — so it does not wait
# on `install` and fails fast.
#
# ONE SCRIPT, TWO LEGS, and the leg NAMES ARE UNCHANGED on purpose: `check`
# below carries [metadata("ci")] and odu expands its dependency list into the
# lane graph, so renaming one of these would rename a CI node for no gain. What
# changed is underneath — `check-kolu-deps.sh` and `check-odu-deps.sh` were the
# same script with the nouns swapped (the second one's own header asked to be
# generalised and named the arguments), and they are now one
# `check-hydrated-deps.sh` invoked once per pin. Still two legs, because the two
# pins are two repositories that move independently and a reader who lands on a
# red leg should already know which one it is about.
#
# WHAT THESE LEGS NO LONGER DO: the import fence. Which package may name
# `@kolu/padi-client` or `@odu/*`, and the `/wire` entries staying
# schemas-and-types, moved to `packages/bundle/src/fence.test.ts` — a `bun test`
# under the `test` leg. Two reasons, both about the old shape rather than about
# tidiness: every one of those greps ended `rg … 2>/dev/null || true` and
# `ripgrep` is not in shell.nix's package list, so on a machine with no ambient
# one the fence passed GREEN having never run; and they swept `packages/*/src`,
# which misses `packages/tests` — the one member with no `src/` — where four
# product-tier `@kolu/*` imports sat with `just check` green. The cost is that
# the fence now waits on `install` where these legs do not; what it buys is a
# fence that cannot silently not-run, and a confinement table DERIVED from the
# plugin registry instead of hand-copied per script.
kolu-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh kolu "$OLAI_KOLU_EXTERNALS"'

# The same three questions about odu's one hydrated package, asked by the same
# script. It gets two assertions it never had — every workspace manifest, and
# the root `overrides` block — which is not a widening for its own sake:
# `@odu/run-client` declares `effect` at this tree's pinned version, and an
# override is how bun SILENTLY REWRITES one, so an unchecked one there makes
# every manifest's honesty cosmetic in exactly the way it already did for kolu.
odu-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh @odu/run-client "$OLAI_ODU_MANIFEST"'

# ...and the same three questions about the four hydrated Cordis packages, over
# the UNION of what they declare (nix/cordis.nix builds it): `cosmokit`,
# `@standard-schema/spec` and `js-yaml`. The four resolve those by walking up
# into the one root node_modules exactly as the @kolu/* members do, so a
# version that drifted here is two `cosmokit`s — the same failure the other two
# legs watch for, read off a third pin.
cordis-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh cordis "$OLAI_CORDIS_MANIFEST"'

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
# Defaults to docs/, which is a served set of DOCUMENTS since the orchestrator's
# vault moved to https://github.com/juspay/oss.olai — `just serve` with no
# arguments shows this project's engineering docs, and a directory of outlines
# (that vault, a checkout of your own) is the argument to pass. `just nix` is
# the other path: the packaged binary, built from tracked files only. Use this
# one while working; that one is what CI proves.
serve dir="docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    # The chat panel defaults to the pinned Claude Code adapter, exactly as the
    # packaged binary does — scripts/acp-agent.sh is the one place that is
    # decided, and `OLAI_ACP_AGENT` overrides it (empty disables).
    export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
    # Codex is shipped from the pin inside its plugin, with a separate override
    # so the historical whole-chat off switch above remains exactly that.
    export OLAI_ACP_CODEX="$(sh scripts/acp-codex.sh)"
    # The pi row's adapter, the other half of the same pin — a machine with a
    # `pi` on the search path gets the row, every other machine gets nothing
    # new (scripts/acp-pi.sh says why the roster probes for the agent).
    export OLAI_ACP_PI="$(sh scripts/acp-pi.sh)"
    # The pinned odu on PATH, exactly as the packaged binary bakes into its
    # wrapper (default.nix) — scripts/olai-path.sh composes the whole
    # variable, so this can be the same one line the acp knobs are. An empty
    # override is off, and off is a DRAWN row, not a quiet plugin.
    # Two lines rather than one `export PATH="$(…)"`: the export builtin's
    # own status is what `set -e` sees, and a failing build script must stop
    # the serve here — continuing would splice an EMPTY PATH, and the next
    # thing run reports `nix: command not found`.
    PATH="$(sh scripts/olai-path.sh)"
    export PATH
    # `kill 0` takes the whole process group down together: a stray bundler
    # watching a tree nobody is serving is a confusing thing to leave behind.
    trap 'kill 0' EXIT INT TERM
    {{ nix_shell }} bun --watch packages/web/src/build.ts {{ dist }} &
    OLAI_DIST_DIR={{ dist }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} {{ args }}

# The one brain: `olai web` on this repo's docs, on an OS-assigned port.
# Distinct from `serve`: that one is the web edit loop (client bundler
# watch + server watch); this one watches only the server. Extra args after
# the directory reach the binary (`--commit=manual`, `--host`, …). Defaults
# to the same pinned agent `just serve` and the packaged binary do: no
# documented way of starting olai may land in the no-agent state by accident.
# A fixed `--port` is a deploy's word, not this recipe's. `--port 0` (the
# default) asks the OS every boot — a `bun --watch` restart may land on a
# new port.
run dir="docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
    export OLAI_ACP_CODEX="$(sh scripts/acp-codex.sh)"
    export OLAI_ACP_PI="$(sh scripts/acp-pi.sh)"
    # The pinned odu on PATH, the same errand one recipe over — see `serve`
    # for why the export is two lines.
    PATH="$(sh scripts/olai-path.sh)"
    export PATH
    OLAI_DIST_DIR={{ dist }} \
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
    out=$(sh scripts/nix-out.sh .#olai)
    echo >&2 "nix run .#olai -- --help"
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
    # The shipped Codex adapter gets its own row and its own off/override
    # variable; it must be baked into the same packaged wrapper.
    codex=$(sed -n "s|.*OLAI_ACP_CODEX=\${OLAI_ACP_CODEX-'\(.*\)'}.*|\1|p" "$out/bin/olai")
    if [ -z "$codex" ]; then
      echo "the packaged binary does not bake OLAI_ACP_CODEX into its wrapper." >&2
      cat "$out/bin/olai" >&2
      exit 1
    fi
    if [ ! -x "$codex" ]; then
      echo "the wrapper's baked OLAI_ACP_CODEX is not executable: $codex" >&2
      exit 1
    fi
    echo "packaged codex adapter: $codex"
    # THE OTHER SHIPPED ADAPTER, checked the same way: the pi row is a no-op
    # on a machine without `pi`, but on one that has it the row spawns
    # whatever this names, so it has to be there and be runnable.
    pi=$(sed -n "s|.*OLAI_ACP_PI=\${OLAI_ACP_PI-'\(.*\)'}.*|\1|p" "$out/bin/olai")
    if [ -z "$pi" ]; then
      echo "the packaged binary does not bake OLAI_ACP_PI into its wrapper," >&2
      echo "so the pi row would never be offered. Wrapper:" >&2
      cat "$out/bin/olai" >&2
      exit 1
    fi
    if [ ! -x "$pi" ]; then
      echo "the wrapper's baked OLAI_ACP_PI is not executable: $pi" >&2
      exit 1
    fi
    echo "packaged pi adapter: $pi"
    # THE BAKED ODU, asserted the same way and for its own incident's sake:
    # the odu plugin's probe resolves `odu` on the SERVER's PATH, so the
    # wrapper's `--set-default OLAI_ODU_BIN` names the pin's bin dir and its
    # `--run` splices it FIRST (default.nix) — a wrapper that stopped doing
    # either would now answer the probe LOUDLY in every conversation instead
    # of being silent (olai-plugin-odu's probe), which is a worse time to
    # find out than this line. Extraction is the two adapter checks' own
    # sed, keyed on the variable SPELLING rather than a store-name pattern:
    # a different wrapping that still mentioned the store dir would lie to
    # the pattern, and the variable spelling is the contract.
    odu_dir=$(sed -n "s|.*OLAI_ODU_BIN=\${OLAI_ODU_BIN-'\(.*\)'}.*|\1|p" "$out/bin/olai")
    if [ -z "$odu_dir" ]; then
      echo "the packaged binary does not name an OLAI_ODU_BIN default," >&2
      echo "so \`nix run\` would start with no odu resolvable — every documented" >&2
      echo "launch path is supposed to carry the pinned one. Wrapper:" >&2
      cat "$out/bin/olai" >&2
      exit 1
    fi
    if ! grep -qF 'export PATH="$OLAI_ODU_BIN${PATH:+:$PATH}"' "$out/bin/olai"; then
      echo "the wrapper names OLAI_ODU_BIN but never splices it onto PATH —" >&2
      echo "the probe would resolve nothing. Wrapper:" >&2
      cat "$out/bin/olai" >&2
      exit 1
    fi
    if [ ! -x "$odu_dir/odu" ]; then
      echo "the wrapper's pinned odu is not executable: $odu_dir/odu" >&2
      exit 1
    fi
    echo "packaged odu: $odu_dir/odu"

# The home-manager module evaluates under a sample config (systemd argv on
# Linux, launchd argv on Darwin). Cheap, no home-manager pin, no activation —
# just the option shape and the service knobs. See nix/home/check.nix.
hm-module:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).hm-module --no-link --accept-flake-config

# What a keystroke costs — on a generated vault, and for the newest of them in
# a real git repository. FOURTEEN of them, and each is a
# LEG rather than a scratch file, because slice 3 of `model-indices` ran its
# numbers as a one-off and a benchmark nobody can re-run is a number nobody can
# check — and deliberately NOT a dependency of `check`, since a timing that
# fails a lane on a busy machine teaches nobody anything.
#
# THE FIFTH WAS THE TAB's own frame, and it is gone with what it timed: it
# measured what a browser paid between a `deltas` frame of the whole set landing
# and having a view of the directory again, and a browser holds no view of the
# directory any more (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10). What
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
#   - ONE WRITE with TABS OPEN, timed as what the five standing views cost the
#     server per published revision at one, three and ten subscribers on one
#     question (`packages/ops/src/standing.bench.ts`, added with
#     `perf-streams-per-tab`). The unit is the leg's whole argument: a page, the
#     filter over it, the calendar, what is owed and the move picker are held
#     OPEN, and the framework gives every subscriber its own poll loop — so what
#     a write costs is what one answer costs times the number of people looking
#     at it, and a benchmark of one answer would print a number nobody pays.
#     TWO EDITS per row, because the change is two claims bought separately: the
#     write lands INSIDE the file the question is about (the answer really did
#     move, so this row is the SHARE alone) and ELSEWHERE (which is what nearly
#     every write is for nearly every open question, and where the pre-check
#     answers and the rebuild does not happen). What is timed is the POLL LOOP
#     and not the read — the framework asks each subscriber's own `isEqual`
#     after every re-read, and leaving that out would price a third of the
#     change at zero. Both arms are in the tree for the scoped query's reason
#     (the "before" is `standing.ts`'s own `rebuilding`, which is also the
#     differential's reference), and the two are replayed against each other at
#     the end of the run, so a divergence throws rather than printing a ratio
#     nobody may believe. Its vault is the harness's rather than `vaultOf`: a
#     third of its files hold no date at all, which is the shape a real
#     directory has and the only one under which the calendar's and the
#     agenda's pre-check can be measured at all. It reads OLAI_BENCH_FILES /
#     OLAI_BENCH_RECORDS like the five that share the other vault;
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
#     directory holding no documents measures the `.md` walk at zero;
#   - FOUR TOOL-CALL WALKS, one row each (`packages/ops/src/walks.bench.ts`,
#     added with the ops bundle — `perf-capture-paths`, `perf-batch-assemble`,
#     `perf-homes-files`, `perf-didyoumean`). Four costs in one PR, so four rows
#     rather than a blended figure nobody pays: where a CAPTURE lands (the whole
#     outline listing against the paths-only question, and a race pays it twice),
#     a BATCH at ten and a hundred ops (the fold that re-assembled the directory
#     per op against the one that splices what the op wrote into the set the
#     last one left), a FOLD CLICK twenty times over one revision (the two
#     all-files structures built per call against the two held with the set),
#     and a REFUSED REFERENCE (the did-you-mean walked against the same offer
#     off the index the ids are held in). Two of the rows carry the honest
#     inside as well as the headline, which is the point of them: the batch row
#     prints what ONE OP's set-building costs beside the end-to-end figure,
#     because a fold op is a serialise, a parse, a set and a patched view and
#     this changed one of the four — and the refusal row runs TWO id spaces,
#     the vault generator's own (`f160n2`, one alphabet, where a bound read off
#     the characters rules little out) and MINTED ids (eight base-36
#     characters, which is what the minter produces and what a directory an
#     agent has been writing into is made of). Every row checks its arms answer
#     the same thing before a figure is quoted. The gates are in the SUITE, not
#     here: the equalities (`packages/ops/src/walks.test.ts`,
#     `following.equivalence.test.ts`, `format/src/set.walks.test.ts`,
#     `format/src/suggest.test.ts`) and the counts (that file's identity
#     assertions, `set.walks`'s comparisons, `suggest.walks`'s matrices);
#   - a DOCUMENT PAGE's referrers, timed as the links index against the walk of
#     every face it replaced (`packages/format/src/pointing.bench.ts`, added
#     with `perf-doc-backlinks-index`). Both arms are in the tree for the
#     scoped query's reason — the "before" is that walk kept as this lane's
#     differential reference (`@olai/format`'s `pointing.testlib.ts`) — and
#     the two must answer the same referrers or the run throws. FOUR numbers,
#     because the index is a TRADE and printing one half would be quoting the
#     good one: the read for pages that HAVE referrers, the read for a page
#     nothing points at (which is most pages, and the row where the shape
#     shows), and the write both ways — the whole directory folded again
#     against the two sets stepped through, with the count of edits that handed
#     the index straight on uncloned. Its vault is `.md`-heavy on purpose: what
#     a read still pays is the walk of the files that really do point here, so
#     the ratio is a function of how thickly the corpus points at itself, and
#     that density is printed rather than left to be inferred. Size it with
#     OLAI_BENCH_OUTLINES / OLAI_BENCH_BODIES / OLAI_BENCH_RECORDS /
#     OLAI_BENCH_PAGES / OLAI_BENCH_EDITS;
#   - the TWO SIDEBAR READINGS per published revision — the pinned shelf and
#     how full the inbox is, timed as they stood against the same two readings
#     over a CARRIED convention (`packages/format/src/conventions.bench.ts`,
#     added with `perf-filename-conventions`). Each of them began by asking
#     WHICH FILE it is about, which is every served basename sliced, folded and
#     compared — per revision, which is per keystroke — for an answer that
#     moves only when a file is added, removed or renamed. THREE ROWS, because
#     the shape of the revision is the whole claim: a keystroke and a `git
#     pull` of twenty, neither of which moves a path and which between them are
#     nearly every revision there is; and a FILE CREATED every time, which is
#     the honest null — the path set moves, the walk runs, and the row reports
#     as 1.0× or thereabouts. Beside each ratio is the count of WALKS the row
#     actually spent out of the two per revision it used to, so a row whose
#     ratio is one says why out loud. Both arms are in the tree for the scoped
#     query's reason — the "before" is `shelfOf` / `inboxHeldOf`, the plain
#     readings, kept as that lane's differential reference — and the two are
#     compared at every revision before a figure is quoted, so a divergence
#     throws rather than printing a ratio nobody may believe. Its vault is
#     `vaultOf` SETTLED (the placements that point at nothing taken out, since
#     this leg publishes its revisions) with a shelf and an inbox put in: a
#     directory with neither is one where both readings answer nothing and half
#     of what is timed never happens. It reads OLAI_BENCH_FILES /
#     OLAI_BENCH_RECORDS / OLAI_BENCH_EDITS.
#
# FIVE of the fourteen run the SAME generated vault (`@olai/format/testlib`'s
# `vaultOf`, unmodified — the patcher, the tag completion, the day readings, the
# search index and the four tool-call walks), so what a write costs the view and
# what a completion, a calendar, a search box or a capture asks of the view it
# leaves are numbers about one directory. THREE MORE BUILD ON IT and say so in
# their own rows, which is why they are not in that count: the published
# revision's puts the other kinds of file in beside the outlines, the
# validation's takes the dangling placements out and puts `.md` in, and the
# sidebar readings' takes the same placements out and puts a shelf and an
# inbox in — each because the leg would otherwise measure a third of its
# subject at zero. The
# matcher, the document listing, the scoped query, the standing views and the
# referrers each generate a corpus of their own — one sized for keystrokes, one
# for a vault of `.md`, one made of TREES, one with a third of its files holding
# no date at all, one that points at itself thickly — and the commit panel's is
# not a vault at all but a real repository in a temporary directory, since what
# it times is subprocesses. The MERGE under all of it is not timed here and
# should not be: it is the framework's, and
# `@kolu/surface`'s own `src/solid/collectionDeltas.bench.ts` measures it end to
# end. Size the vault with OLAI_BENCH_FILES / OLAI_BENCH_RECORDS /
# OLAI_BENCH_EDITS — and turning the last one up to 900 is what makes the
# patcher's layer grow past half the id map and flatten, which it prints the
# edit of. Size the document listing with OLAI_BENCH_DOCS; the published
# revision, the standing views and the tool-call walks read OLAI_BENCH_FILES /
# OLAI_BENCH_RECORDS like the four above them — the standing views over a vault
# of their own (`@olai/ops`' `standing.testlib.ts`), for the reason that leg's
# own paragraph gives; the referrers have four sizes of their own, named in
# their row.

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
    {{ nix_shell }} bun packages/ops/src/standing.bench.ts
    {{ nix_shell }} bun packages/format/src/validate.bench.ts
    {{ nix_shell }} bun packages/format/src/pointing.bench.ts
    {{ nix_shell }} bun packages/ops/src/walks.bench.ts
    {{ nix_shell }} bun packages/format/src/conventions.bench.ts

# A worktree-local wrapper the e2e harness can spawn (`OLAI_BIN=` this)
# instead of the nix-built binary. `/tmp/olai-dev` is how two worktrees
# used to drive one tree; this file lives in THIS worktree.
#
# THE ODU FACE OF “the same binary”: a wrapper that only changed the argv
# would be the ONE spawn shape with no odu answer of its own, and
# isolateEnv deleting the host's OLAI_ODU_BIN (workers.ts) would make the
# roster features host-dependent on exactly the loop the README hands
# developers. The generated file therefore re-spells default.nix's own
# shape: a set-default line for the pin's bin dir, the same three-arm
# splice. `serve`/`run` ask scripts/olai-path.sh to compose the variable
# on every run; this file is WRITTEN once per worktree, so it composes
# the default at write time the way the nix wrapper does at build time —
# one knob, every face is only true when this face answers too.
dev-bin:
    #!/usr/bin/env bash
    set -euo pipefail
    dir="{{ justfile_directory() }}/.olai-dev"
    mkdir -p "$dir"
    # The same build-on-demand scripts/olai-path.sh's header spends a
    # paragraph defending: here at WRITE time rather than each spawn.
    odu_dir="$(sh scripts/nix-out.sh .#odu-bin)/bin"
    printf '#!/usr/bin/env bash\n' > "$dir/bin"
    printf 'export OLAI_ODU_BIN="${OLAI_ODU_BIN-%s}"\n' "$odu_dir" >> "$dir/bin"
    printf '%s\n' 'if [ -n "$OLAI_ODU_BIN" ]; then if [ -d "$OLAI_ODU_BIN" ]; then export PATH="$OLAI_ODU_BIN${PATH:+:$PATH}"; else echo "olai: OLAI_ODU_BIN=$OLAI_ODU_BIN is not a directory — no odu goes on the PATH of this serve" >&2; fi; fi' >> "$dir/bin"
    printf 'exec bun %s/packages/server/src/main.ts "$@"\n' \
      "{{ justfile_directory() }}" >> "$dir/bin"
    chmod +x "$dir/bin"
    echo "$dir/bin"

# The browser tests: Cucumber features driven through Playwright against the
# nix-built binary, which is what a user actually runs. `nix` is a dependency
# as well as the shell so the binary is an already-realised lookup here rather
# than a Nix build racing the one that leg is doing.
#
# Odu may borrow up to SIX free execution slots for this leaf. Six is a ceiling,
# not a reservation: Odu tells every slice the total it actually obtained, and
# Cucumber's native sharder therefore still covers the whole suite when fewer
# slots are free. Odu numbers slices from zero; Cucumber numbers them from one.
# The conditional keeps `just e2e` the ordinary unsharded local command.
[metadata("odu:shard=6")]
e2e: install nix
    #!/usr/bin/env bash
    set -euo pipefail
    bin="$(sh scripts/nix-out.sh .#olai)/bin/olai"
    cd packages/tests
    # `cd` rather than `bun --cwd`: with --cwd, bun swallows the script name and
    # prints its own help with status 0, which reads as a passing leg that ran
    # no tests at all.
    if [[ -n "${ODU_SHARD_TOTAL:-}" ]]; then
      export CUCUMBER_SHARD="$((ODU_SHARD_INDEX + 1))/$ODU_SHARD_TOTAL"
    fi
    OLAI_BIN="$bin" {{ nix_shell_e2e }} bun run test

# The browser-only spelling of the same Odu pipeline. This is a thin convenience
# target, not another scheduler: it builds this tree's pinned Odu and selects
# the `e2e` leaf on Linux. A bare `odu run` remains the full CI UX, including
# the same shared E2E leaf and GitHub posting. Ten minutes is a wall-clock
# backstop, not a scheduler policy; SIGINT lets Odu finalize statuses and free
# every lease before coreutils escalates. Override only for a deliberate cold
# provisioning experiment (`ODU_E2E_REMOTE_TIMEOUT=20m`).
e2e-fast-remote:
    #!/usr/bin/env bash
    set -euo pipefail
    {{ nix_shell }} bash -c '
      odu="$(nix build .#odu-bin --no-link --print-out-paths --accept-flake-config)/bin/odu"
      exec timeout --foreground --signal=INT --kill-after=30s \
        "${ODU_E2E_REMOTE_TIMEOUT:-10m}" \
        "$odu" run e2e --platform x86_64-linux
    '

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
