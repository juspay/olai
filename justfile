# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

# Personal outline data (outside the repo). Override with SELFFLOWY_HOME.
selfflowy_home := env_var_or_default("SELFFLOWY_HOME", env_var("HOME") + "/Dropbox/Selfflowy-Srid")

# Top-level *.rkt in $SELFFLOWY_HOME are roots (Tasks, Daily, a Roadmap
# @include, ...); include fragments live in subdirectories (Daily/), so the
# glob never double-loads.
default_outlines := selfflowy_home + "/*.rkt"

default:
    @just --list

# Runtime deps (gregor, markdown) + raco link ./selfflowy; cheap to repeat
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline(s) (default: $SELFFLOWY_HOME/*.rkt)
check *args: install
    selfflowy check {{if args == "" { default_outlines } else { args }}}

# Outline(s) as JSON (agents; human view is the web app)
tree *args: install
    selfflowy tree {{if args == "" { default_outlines } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING (merged across files, done excluded)
agenda *args: install
    selfflowy agenda {{if args == "" { default_outlines } else { args }}}

# Flags-only invocations (e.g. --month 2026-08) keep the default outlines.
# Calendar days with dated items (default: current month, done included)
calendar *args: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{args}}" ]; then
      selfflowy calendar {{default_outlines}}
    elif [[ "{{args}}" != *".rkt"* ]]; then
      selfflowy calendar {{args}} {{default_outlines}}
    else
      selfflowy calendar {{args}}
    fi

# Bare `just ics` writes ./Tasks.ics; --out or explicit paths override.
# RFC 5545 VCALENDAR of dated tasks (done included)
ics *args: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{args}}" ]; then
      selfflowy ics --out Tasks.ics {{default_outlines}}
    elif [[ "{{args}}" != *".rkt"* ]]; then
      selfflowy ics {{args}} {{default_outlines}}
    else
      selfflowy ics {{args}}
    fi

# Capture under Inbox in $SELFFLOWY_HOME/Tasks.rkt; never commits
add *args: install
    selfflowy add --no-commit {{args}}

# Done by exact title or ^anchor (--undo reverses); never commits
done *args: install
    selfflowy done --no-commit {{args}}

# Set @date by exact title or ^anchor (--clear removes it); never commits
move *args: install
    selfflowy move --no-commit {{args}}

# Ensure today's day node in $SELFFLOWY_HOME Daily/YYYY-MM.rkt
daily *args: install
    selfflowy daily {{args}}

# serve takes the DIRECTORY, not the glob: it globs the top level itself, and
# the agent then works in $SELFFLOWY_HOME (which is what makes its stored
# sessions survive a restart). SELFFLOWY_ACP_AGENT comes from the nix dev
# shell; serve will not start without it, so export it yourself outside
# `nix develop`.
# Serve the web view (default: $SELFFLOWY_HOME on 127.0.0.1:8080)
serve *args: install
    selfflowy serve {{if args == "" { selfflowy_home } else { args }}}

# The server is how you run selfflowy; it reloads an outline when it changes.
alias run := serve
alias watch := serve

# Run unit tests
test: install
    raco test -p selfflowy
