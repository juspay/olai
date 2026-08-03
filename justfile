# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

default:
    @just --list

# Install / link the local package (idempotent enough for dev)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed gregor markdown
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline (default: Tasks.rkt)
check *args: install
    selfflowy check {{if args == "" { "Tasks.rkt" } else { args }}}

# Outline as JSON (agents; human view is html)
tree *args: install
    selfflowy tree {{if args == "" { "Tasks.rkt" } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING
agenda *args: install
    selfflowy agenda {{if args == "" { "Tasks.rkt" } else { args }}}

# Capture under Inbox
add *args: install
    selfflowy add --no-commit {{args}}

# Mark a task done by exact title (or: just done --undo TITLE...)
done *args: install
    selfflowy done --no-commit {{args}}

# Render HTML tree (default Tasks.rkt -> Tasks.html)
html file="Tasks.rkt": install
    #!/usr/bin/env bash
    set -euo pipefail
    out="{{file}}"
    out="${out%.rkt}.html"
    selfflowy html --out "$out" "{{file}}"

# Re-render HTML whenever Tasks.rkt changes
watch: install
    watchexec -w Tasks.rkt -c -- just html

# Run unit tests
test: install
    raco test -p selfflowy
