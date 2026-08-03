# selfflowy

An outliner for people who think the filesystem was right all along.

Self-hosted, AI-native alternative to Workflowy. Your outline is a bunch
of `#lang selfflowy` files in a git repo. You edit them with `$EDITOR` or
point a coding agent at them. A small Racket server renders the tree to
your phone. That's it. No cloud, no accounts, no Electron.

## WHY

Workflowy got the data model right (one big tree, mirrors, dates) and
the ownership model wrong (their server, their format, their AI).

Selfflowy inverts it:

  * tasks are CODE      -- a Racket #lang; the expander is the validator
  * git is the HISTORY  -- no sync protocol, no CRDT, no vendor
  * agents are USERS    -- Claude Code & friends edit your files over
                           ACP; the DSL's error messages are their REPL
  * the web UI is a VIEW -- read-mostly HTMX + SSE; quick capture and
                           check-off, nothing more. Structure changes go
                           through the agent or your editor.

Mirrors fall out of the language for free: a node is a binding,
referencing it twice is a mirror. define-before-use kills most cycles
before they exist.

## SYNTAX

Quoteless outline (flagship). Nest with 2 spaces; attach notes and dates
under a title:

    #lang selfflowy

    Inbox #capture
      : Quick capture landing zone
      Buy milk — don't quote me
        @date 2026-08-04

Inline `#tags` stay in the title; the expander also records them on the
task. Full rules (and what is deliberately not implemented): `docs/syntax.md`.

Under the hood every outline becomes s-expressions. Same expander:

    #lang selfflowy/sexp
    (t "Inbox #capture"
       #:description "Quick capture landing zone"
       (t "Buy milk" #:date "2026-08-04"))

## HOW IT WORKS

    ~/tasks/*.rkt                    <- source of truth (#lang selfflowy)
        |
        v
    selfflowy CLI (Racket)           <- validate / query / render / capture
        |
        v
    racket web-server ---- SSE ----> browser (PWA, htmx)
        |
        +-- spawns agent CLI over ACP (JSON-RPC on stdio)

Single user, many devices. The server runs on your headless box behind
Caddy or Tailscale. Offline you can read and queue captures; you cannot
restructure. Live with it, or open your laptop.

## STATUS

Outline `#lang selfflowy` + sexp core + `check` / `tree` / `agenda` /
`add` (agent-first `--json`). (Ancestor: srid/Tend, same idea in Lean.)

## ROADMAP

The roadmap is a selfflowy outline:
`selfflowy tree examples/Roadmap.rkt` (phases 0.1–1.0).

## BUILDING

    nix develop        # racket 9.2 + just; or install them yourself
    just install       # raco pkg install --link selfflowy/
    just check         # validates Tasks.rkt (gitignored private outline)
    just tree examples/Example.rkt
    just agenda examples/Example.rkt
    just test

## CLI (agents)

Machine-readable contract (`--json`, exit codes, `add`): **docs/cli.md**.

## HACKING

Patches welcome. Keep it small, keep it boring. The interesting part is
the DSL; write good expander error messages -- the agents read them.

## LICENSE

AGPL-3.0. Self-host it, fork it, but keep the network service free.
