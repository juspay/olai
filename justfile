# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

# Default outlines for read commands (private Tasks + canonical roadmap)
default_outlines := "Tasks.rkt examples/Roadmap.rkt"

default:
    @just --list

# Install / link the local package (idempotent enough for dev)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline(s) (default: Tasks.rkt + examples/Roadmap.rkt)
check *args: install
    selfflowy check {{if args == "" { default_outlines } else { args }}}

# Outline(s) as JSON (agents; human view is html)
tree *args: install
    selfflowy tree {{if args == "" { default_outlines } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING (merged across files)
agenda *args: install
    selfflowy agenda {{if args == "" { default_outlines } else { args }}}

# Capture under Inbox
add *args: install
    selfflowy add --no-commit {{args}}

# Mark a task done by exact title (or: just done --undo TITLE...)
done *args: install
    selfflowy done --no-commit {{args}}

# Render HTML (default: Tasks.rkt + Roadmap -> Tasks.html)
html *args: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{args}}" ]; then
      selfflowy html --out Tasks.html Tasks.rkt examples/Roadmap.rkt
    else
      # First path stems the default out name when a single file is given
      set -- {{args}}
      out="${1%.rkt}.html"
      selfflowy html --out "$out" "$@"
    fi

# Re-render HTML whenever Tasks.rkt or the roadmap changes
watch: install
    watchexec -w Tasks.rkt -w examples/Roadmap.rkt -c -- just html

# Run unit tests
test: install
    raco test -p selfflowy
