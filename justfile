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

# The port `just run` (and `just serve`) bind. `.mcp.json` names the same
# number so a clone can point an agent at this repo's server without editing
# either file. 7714 is "olai" on a phone keypad — the same default `olai web`
# uses. Override per-invocation with `--port` on the recipe's extra args
# only if something else already holds this one; a changed default here
# must move `.mcp.json` with it.
port := "7714"

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

# Unit tests
test: install
    {{ nix_shell }} bun test

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
    OLAI_DIST_DIR={{ dist }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} --port {{ port }} {{ args }}

# The one brain: `olai web` on this repo's docs, on the `port` above, so a
# `.mcp.json` URL holds. Distinct from `serve`: that one is the web edit
# loop (client bundler watch + server watch); this one watches only the
# server. Extra args after the directory reach the binary (`--commit=manual`,
# `--host`, …). Defaults to the same pinned agent `just serve` and the
# packaged binary do: no documented way of starting olai may land in the
# no-agent state by accident.
run dir="docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
    OLAI_DIST_DIR={{ dist }} {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} --port {{ port }} {{ args }}

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

# What a keystroke costs, on a generated vault. FOUR of them now, and each is
# a LEG rather than a scratch file, because slice 3 of `model-indices` ran its
# numbers as a one-off and a benchmark nobody can re-run is a number nobody can
# check — and deliberately NOT a dependency of `check`, since a timing that
# fails a lane on a busy machine teaches nobody anything.
#
#   - the tab's derived memo, timed as it was (flatten the corpus and derive
#     it) against as it is (patch the held view with the file that moved);
#   - the PATCHER underneath it, with the browser taken out of the picture —
#     `derive` over the whole corpus, against `patched` on the view the last
#     edit left, against that same patch paying the id-map clone the overlay
#     replaced (`packages/format/src/patch.bench.ts`). It is the harness slice 3
#     measured its order-of-magnitude figure with and did not commit, which is
#     why architecture.md called that number one this tree could not reproduce,
#     and the third arm is there so the overlay's own before/after is printed
#     rather than quoted;
#   - the MATCHER, timed with the fold it keeps per record against without it —
#     what the filter over a page and the chat composer's `@` list each pay per
#     keystroke (`packages/format/src/filter.bench.ts`, added when a reviewer
#     asked where the milliseconds in its header came from);
#   - the TAG COMPLETION, timed as an index read against the corpus walk it
#     replaced (`packages/web/src/client/complete/tags.bench.ts`, added with
#     `taggedBy` — the roadmap deferred that index until somebody measured this
#     walk, so the measurement is a leg rather than a paragraph). Its two arms
#     must answer the same list or the run fails; what the wider index costs the
#     FOLD is the pair the second leg prints at the end.
#
# Three of the four run the SAME generated vault (`@olai/format/testlib`'s
# `vaultOf`), so a frame's cost, the patch inside it and what a completion asks
# of it are numbers about one directory. `--conditions browser` is load-bearing for the FIRST: without
# it Bun resolves SolidJS's server build, whose memos never re-run, and every
# arm reports an empty loop. Size both with OLAI_BENCH_FILES /
# OLAI_BENCH_RECORDS / OLAI_BENCH_EDITS — and turning the last one up to 900 is
# what makes the second leg's layer grow past half the id map and flatten, which
# it prints the edit of.
bench: install
    {{ nix_shell }} bun --conditions browser packages/web/src/client/deriving.bench.ts
    {{ nix_shell }} bun packages/format/src/patch.bench.ts
    {{ nix_shell }} bun packages/format/src/filter.bench.ts
    {{ nix_shell }} bun packages/web/src/client/complete/tags.bench.ts

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

# Update the kolu / nixpkgs pins. npins rewrites npins/default.nix in its own
# formatter's style, so normalize it here — same rule as bun.nix, and the
# reason fmt-check needs no exception list. `just check` then names anything
# the new kolu revision expects that this repo has not moved with it.
update-pins:
    {{ nix_shell }} sh -c 'npins update && nixpkgs-fmt npins/default.nix'
