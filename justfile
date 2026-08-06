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
repo_outlines := "examples/Example.rkt Roadmap.rkt"
default_outlines := if olai_home == "" { repo_outlines } else { olai_home + "/*.rkt" }

# odu CI DAG: [metadata("ci")] lives in ci/mod.just. `just ci` is the local
# pipeline; `nix run github:juspay/odu -- run` is the attachable runner.
mod ci 'ci/mod.just'

default:
    @just --list

# Deps + raco link ./olai (cheap; does not recompile — use `just build`)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown css-expr
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/olai

# raco setup --pkgs olai: write .zo and keep them coherent (see docs/hacking.md)
build: install
    raco setup --pkgs olai

# Drop olai/**/compiled (linklet-mismatch escape hatch; prefer `just build`)
clean:
    #!/usr/bin/env bash
    set -euo pipefail
    find olai -type d -name compiled -print0 | xargs -0 rm -rf

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

# The two sets differ in what they cost: unit tests run in this VM, the
# integration ones spawn `olai` subprocesses and boot real servers. Both are
# parallel-safe (ephemeral ports, temp dirs), so -j is free speed.

# The skin's class list, sorted, one per line: what olai/tests/style.rkt
# compares (class-names) against. A rename is one line gone and one added, in
# a diff — accepted by running this, never by hand-editing the file.
# Regenerate olai/tests/classes.golden from the skin
css-classes: install
    racket -e '(require olai/web/skin (only-in olai/web/style class-names)) (for-each displayln (sort (class-names) string<?))' > olai/tests/classes.golden

# Unit tests: in-process, no subprocesses (olai/tests/*.rkt)
test: build
    raco test -j {{ num_cpus() }} olai/tests/*.rkt

# Integration tests: subprocess CLI + real servers (olai/tests/integration/)
test-integration: build
    raco test -j {{ num_cpus() }} olai/tests/integration/

# Everything, in one -j pool so the slow files start first
test-all: build
    raco test -j {{ num_cpus() }} olai/tests/integration/ olai/tests/*.rkt
