# selfflowy developer recipes

export PLTUSERHOME := env_var_or_default("PLTUSERHOME", justfile_directory() / ".plt-user")
export PATH := PLTUSERHOME / ".local/share/racket/9.2/bin:" + env_var("PATH")

default:
    @just --list

# Install / link the local package (idempotent enough for dev)
install:
    mkdir -p "{{PLTUSERHOME}}"
    raco pkg install --auto --skip-installed --link {{justfile_directory()}}/selfflowy

# Validate outline (default: Tasks.rkt)
# Usage: just check
#        just check examples/Example.rkt
check *args: install
    selfflowy check {{if args == "" { "Tasks.rkt" } else { args }}}

# Print outline tree
# Usage: just tree
#        just tree examples/Example.rkt
tree *args: install
    selfflowy tree {{if args == "" { "Tasks.rkt" } else { args }}}

# Dated tasks: OVERDUE / TODAY / UPCOMING
# Usage: just agenda
#        just agenda examples/Example.rkt
agenda *args: install
    selfflowy agenda {{if args == "" { "Tasks.rkt" } else { args }}}

# Re-run `just tree` whenever Tasks.rkt changes (clears the screen each time)
watch: install
    watchexec -w Tasks.rkt -c -- just tree

# Run unit tests
test: install
    raco test -p selfflowy
