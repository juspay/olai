# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

# Personal outline data (outside the repo). Override with SELFFLOWY_HOME.
selfflowy_home := env_var_or_default("SELFFLOWY_HOME", env_var("HOME") + "/Dropbox/Selfflowy-Srid")

# Default outlines for read commands: Tasks + Daily + live Roadmap (all data).
default_outlines := selfflowy_home + "/Tasks.rkt " + selfflowy_home + "/Daily.rkt " + selfflowy_home + "/Roadmap.rkt"

default:
    @just --list

# Install / link the local package (idempotent enough for dev)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline(s) (default: $SELFFLOWY_HOME/{Tasks,Daily,Roadmap}.rkt)
check *args: install
    selfflowy check {{if args == "" { default_outlines } else { args }}}

# Outline(s) as JSON (agents; human view is the web app)
tree *args: install
    selfflowy tree {{if args == "" { default_outlines } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING (merged across files)
agenda *args: install
    selfflowy agenda {{if args == "" { default_outlines } else { args }}}

# Calendar days with dated items (default: current month, Dropbox outlines).
# Flags only (e.g. --month 2026-08) still load the default outlines.
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

# RFC 5545 VCALENDAR of dated tasks
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

# Capture under Inbox (default file: $SELFFLOWY_HOME/Tasks.rkt)
add *args: install
    selfflowy add --no-commit {{args}}

# Mark a task done by exact title (or: just done --undo TITLE...)
done *args: install
    selfflowy done --no-commit {{args}}

# Ensure today's day node in $SELFFLOWY_HOME Daily/YYYY-MM.rkt
daily *args: install
    selfflowy daily {{args}}

# Serve the web view (default: Dropbox outlines on 127.0.0.1:8080)
serve *args: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{args}}" ]; then
      selfflowy serve {{default_outlines}}
    elif [[ "{{args}}" != *".rkt"* ]]; then
      selfflowy serve {{args}} {{default_outlines}}
    else
      selfflowy serve {{args}}
    fi

# The server is how you run selfflowy; it re-reads outlines per request.
alias run := serve
alias watch := serve

# Run unit tests
test: install
    raco test -p selfflowy
