# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

# Default outlines: private Tasks + Daily + committed roadmap
default_outlines := "private/Tasks.rkt private/Daily.rkt examples/Roadmap.rkt"

default:
    @just --list

# Install / link the local package (idempotent enough for dev)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline(s) (default: private/* + examples/Roadmap.rkt)
check *args: install
    selfflowy check {{if args == "" { default_outlines } else { args }}}

# Outline(s) as JSON (agents; human view is html)
tree *args: install
    selfflowy tree {{if args == "" { default_outlines } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING (merged across files)
agenda *args: install
    selfflowy agenda {{if args == "" { default_outlines } else { args }}}

# Capture under Inbox (default file: private/Tasks.rkt)
add *args: install
    selfflowy add --no-commit {{args}}

# Mark a task done by exact title (or: just done --undo TITLE...)
done *args: install
    selfflowy done --no-commit {{args}}

# Render HTML (default: private outlines + Roadmap -> Tasks.html)
html *args: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{args}}" ]; then
      out=Tasks.html
      rm -f "$out"
      selfflowy html --out "$out" private/Tasks.rkt private/Daily.rkt examples/Roadmap.rkt
    else
      # First path stems the default out name when a single file is given
      set -- {{args}}
      out="${1%.rkt}.html"
      # avoid writing into private/ when stemming a private path
      out="$(basename "$out")"
      rm -f "$out"
      selfflowy html --out "$out" "$@"
    fi

# Re-render HTML whenever private outlines or the roadmap change
watch: install
    watchexec -w private -w examples/Roadmap.rkt -c -- just html

# Run unit tests
test: install
    raco test -p selfflowy
