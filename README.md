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
        @date 2026-08-04T18:00
      [x] Already shipped the pitch
        @done 2026-08-03

Titles and notes are Markdown at **render** time (web view only); stored
strings stay raw. Check off with `[x] ` / `@done` (or `selfflowy done TITLE`).
Full rules: `docs/syntax.md`.

Under the hood every outline becomes s-expressions. Same expander:

    #lang selfflowy/sexp
    (t "Inbox #capture"
       #:description "Quick capture landing zone"
       (t "Buy milk" #:date "2026-08-04T18:00")
       (t "Already shipped the pitch" #:done "2026-08-03"))

## HOW IT WORKS

    $SELFFLOWY_HOME/*.rkt            <- personal data (#lang selfflowy)
    (default: ~/Dropbox/Selfflowy-Srid/)
        |
        v
    selfflowy CLI (Racket)           <- validate / query / capture
        |
        v
    racket web-server ---- SSE ----> browser (PWA, htmx)
        |
        +-- spawns agent CLI over ACP (JSON-RPC on stdio)

Personal outlines are plain files you sync however you like (Dropbox,
git, rsync). The repo holds the tool; your data stays outside it.
`add` / `done` auto-commit only when the outline dir is a git work tree;
otherwise they write the file and leave history to your sync layer.

Single user, many devices. The server runs on your headless box behind
Caddy or Tailscale. Offline you can read and queue captures; you cannot
restructure. Live with it, or open your laptop.

## STATUS

Outline `#lang selfflowy` + sexp core + agent CLI (`check` / `tree` JSON /
`agenda` / `calendar` / `add` / `done` / `move` / `daily` / `ics` /
`serve`). Done status, in-file mirrors and `@include` composition are
first class. The human view is the web app served by `selfflowy serve`
(htmx + SSE; read-only, no auth — bind it to localhost or Tailscale);
there is no static HTML export. (Ancestor: srid/Tend.)

## ROADMAP

Track your own plan as a `#lang selfflowy` outline (e.g. under
`$SELFFLOWY_HOME/Roadmap.rkt`). The repo's `examples/Roadmap.rkt` is
fictional demo data only.

## BUILDING

    nix develop        # racket 9.2 + just; or install them yourself
    just install       # raco pkg install --link selfflowy/
    just check         # validates $SELFFLOWY_HOME/{Tasks,Daily,Roadmap}.rkt
    just tree examples/Example.rkt   # JSON forest for agents
    just serve                       # web view on http://127.0.0.1:8080
    just agenda
    just calendar --month 2026-08
    just test

## CLI (agents)

Machine-readable contract (`--json`, exit codes, `add`): **docs/cli.md**.
No ANSI. Humans use the web app.

## HACKING

**No hand-rolling where a library exists.** Prefer maintained packages
(`racket/cmdline`, `json`, `gregor`, `markdown`, `xml` xexprs) over
home-grown parsers and escape codes.

Patches welcome. Keep it small, keep it boring. The interesting part is
the DSL; write good expander error messages -- the agents read them.

## LICENSE

AGPL-3.0. Self-host it, fork it, but keep the network service free.
