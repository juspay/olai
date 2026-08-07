# olai developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

# Personal outline data lives outside the repo: set OLAI_HOME to it. Unset,
# the read recipes fall back to the repo's own outlines and the write ones
# (add/done/move/daily) let olai say what is missing.
olai_home := env_var_or_default("OLAI_HOME", "")

# Top-level *.rkt in $OLAI_HOME are roots (Tasks, Daily, a Roadmap
# @include, ...); include fragments live in subdirectories (Daily/), so the
# glob never double-loads.
#
# The examples are a SET on purpose: Week.rkt mirrors an anchor
# Example.rkt declares, and an anchor's scope is every outline loaded together
# (docs/syntax.md, Mirrors). Named apart, Week.rkt's *agent reaches nothing —
# which is the feature saying so, not a bug in the list. Daily.rkt rides along
# as the glob-include demo.
repo_outlines := "examples/Example.rkt examples/Week.rkt examples/Daily.rkt Roadmap.rkt"
default_outlines := if olai_home == "" { repo_outlines } else { olai_home + "/*.rkt" }

# odu CI DAG: [metadata("ci")] lives in ci/mod.just. `just ci` is the local
# pipeline; `nix run github:juspay/odu -- run` is the attachable runner.
mod ci 'ci/mod.just'

default:
    @just --list

# Three collections, and the order is the dependency: `arch` is the declaration
# language every package here writes its arch.rkt in, `live` is the live-view
# framework (its own package, no olai imports), `olai` is its first consumer.
# Linking them in that order is what keeps a declared dep from sending raco to
# a catalog for a package that lives in this repo.

# The browser runtime `live/` ships is pinned upstream (npins) and built by
# live/default.nix, not committed. The devShell exports where it landed; this
# copies it into live/static/, beside the collection's own live.js, which is
# where define-runtime-path looks. Copied rather than symlinked: `raco pkg
# install --copy` and `raco exe` both follow the directory, and a dangling
# link into /nix/store after a GC is a worse failure than a stale byte.
# Gitignored, so a stale copy is invisible to git and cheap to redo.
[private]
vendor:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${OLAI_LIVE_ASSETS:-}" ] || [ -z "${OLAI_HLJS_ASSETS:-}" ]; then
      echo "vendor: OLAI_LIVE_ASSETS / OLAI_HLJS_ASSETS unset — run inside \`nix develop\`" >&2
      exit 1
    fi
    install -m 0644 "$OLAI_LIVE_ASSETS"/* {{justfile_directory()}}/live/static/
    # olai's own vendored asset (nix/highlight-js.nix): a directory of its
    # own, gitignored whole, so nothing here is ever mistaken for ours.
    install -d {{justfile_directory()}}/olai/web/static/hljs
    install -m 0644 "$OLAI_HLJS_ASSETS"/* {{justfile_directory()}}/olai/web/static/hljs/

# Deps + raco link ./arch, ./live and ./olai (cheap; does not recompile — use `just build`)
# `arch` first: every package here carries arch.rkt declarations, and those are
# `#lang arch` modules the other two cannot compile without it (arch/README.md).
install: vendor
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown css-expr
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/arch
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/live
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/olai

# raco setup: write .zo and keep them coherent (see docs/hacking.md)
build: install
    raco setup --pkgs arch live olai

# Drop every compiled/ (linklet-mismatch escape hatch; prefer `just build`)
clean:
    #!/usr/bin/env bash
    set -euo pipefail
    find arch live olai -type d -name compiled -print0 | xargs -0 rm -rf

# The CLI answers in JSON (the human view is `just serve`); these recipes only
# spell the default outlines.

# Validate outline(s) (default: $OLAI_HOME/*.rkt, else the repo's own)
check *args: install
    olai check {{if args == "" { default_outlines } else { args }}}

# With OLAI_HOME set, serve takes the DIRECTORY, not the glob: it globs the
# top level itself, and the agent then works in $OLAI_HOME (which is what makes
# its stored sessions survive a restart). Unset, it serves the repo's own two
# files by name. OLAI_ACP_AGENT comes from the nix dev shell; serve will not
# start without it, so export it yourself outside `nix develop`.
# Serve the web view (default: $OLAI_HOME, else the repo's own, on 127.0.0.1:8080)
serve *args: install
    olai serve {{if args != "" { args } else if olai_home != "" { olai_home } else { repo_outlines } }}

# What the live forms in a file expand to — the source form and the call it
# becomes, one pair per form (live/expand.rkt). The forms are only worth having
# if you can see through them, so this is interface and not a debug aid.
# Print what the live forms in FILE expand to
expand file: build
    racket {{justfile_directory()}}/live/expand.rkt {{file}}

# The layering, checked against the arch.rkt declarations beside the code:
# which way dependencies point, who owns which ambient authority, one owner per
# tagged concept, and whether `git log` agrees with the clocks (arch/README.md).
#
# `build` first, for the same reason `test` does it: the checker asks compiled
# modules what they import and export, and with .zo on disk the whole tree is
# about two seconds — the edit loop's cost class, not CI's.
#
# Arguments are the checker's: `--explain FILE` prints one module's effective
# declaration after defaults and overrides, `--window N` audits N commits.
# The checker is only worth having if you can see what it thinks, so --explain
# is interface and not a debug aid.

# Check the declared architecture (args: --explain FILE, --window N)
arch *args: build
    racket {{justfile_directory()}}/arch/main.rkt {{args}} {{justfile_directory()}}

# The two sets differ in what they cost: unit tests run in this VM, the
# integration ones spawn `olai` subprocesses and boot real servers. Both are
# parallel-safe (ephemeral ports, temp dirs), so -j is free speed.

# The skin's class list, sorted, one per line: what olai/tests/style.rkt
# compares (class-names) against. A rename is one line gone and one added, in
# a diff — accepted by running this, never by hand-editing the file.
# Regenerate olai/tests/classes.golden from the skin
css-classes: install
    racket -e '(require olai/web/skin (only-in olai/web/style class-names)) (for-each displayln (sort (class-names) string<?))' > olai/tests/classes.golden

# Unit tests: in-process, no subprocesses (arch/tests/ + live/tests/ + olai/tests/*.rkt)
test: build
    raco test -j {{ num_cpus() }} arch/tests/*.rkt live/tests/*.rkt olai/tests/*.rkt

# Integration tests: subprocess CLI + real servers (olai/tests/integration/)
test-integration: build
    raco test -j {{ num_cpus() }} olai/tests/integration/

# Everything, in one -j pool so the slow files start first
test-all: build
    raco test -j {{ num_cpus() }} olai/tests/integration/ arch/tests/*.rkt live/tests/*.rkt olai/tests/*.rkt

# Browser journeys: what the wire tests cannot see, because no JS runs there
# (folding, prefs, the live swap, the chat panel). NEVER part of `just test` —
# that stays the fast racket set. Its own nix shell (node + a pinned chromium),
# entered here rather than by the caller; OLAI_E2E_SHELL says we are in it.
e2e_shell := if env('OLAI_E2E_SHELL', '') != '' { '' } else { 'nix develop .#e2e --accept-flake-config -c' }

# `build` runs INSIDE that shell rather than as a dependency of this recipe:
# a dependency runs in whatever shell the caller had, and the racket-less one
# is exactly the shell a developer types `just e2e` from. One entry, not two —
# a flake eval is a couple of seconds, and this is an edit-loop recipe.

# Browser journeys (args are cucumber's: FILE, FILE:LINE, --tags '@skip')
e2e *args:
    {{ e2e_shell }} bash -euc 'just build && just e2e-run "$@"' -- {{ args }}

# The runner, inside the e2e shell. `vendor` and not `build`: the browser
# runtime has to be on disk for the page to work, and staging it is a copy
# rather than a package operation — so this node stays independent of the
# racket lanes even when odu runs it with --no-deps (see the header).
# The runner, inside the e2e shell: link the nix-built node_modules into place
# (ESM resolution walks up from the importing file and ignores NODE_PATH) and
# hand the rest to cucumber. CI calls this one directly — its `build` is a
# separate DAG node, and a lane body that rebuilt would race the others
# (ci/mod.just).
e2e-run *args: vendor
    #!/usr/bin/env bash
    set -euo pipefail
    ln -sfn "$OLAI_E2E_NODE_MODULES" e2e/node_modules
    cd e2e
    exec node_modules/.bin/cucumber-js {{ args }}
