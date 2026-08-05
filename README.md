# olai

ஓலை: the palm leaf Tamil was written on for two millennia — nodes are
leaves, your files are the manuscript.

An outliner for people who think the filesystem was right all along.

Self-hosted, AI-native alternative to Workflowy. Your outline is a bunch
of `#lang olai` files in a git repo. You edit them with `$EDITOR` or
point a coding agent at them. A small Racket server renders the tree to
your phone. That's it. No cloud, no accounts, no Electron.

## WHY

Workflowy got the data model right (one big tree, mirrors, dates) and
the ownership model wrong (their server, their format, their AI).

olai inverts it:

  * tasks are CODE      -- a Racket #lang; the expander is the validator
  * git is the HISTORY  -- no sync protocol, no CRDT, no vendor
  * agents are USERS    -- Claude Code & friends edit your files; the
                           DSL's error messages are their REPL. The web
                           view spawns one over ACP and puts it in a
                           chat panel.
  * the web UI is a VIEW -- htmx, pushed over SSE: save a file and every
                           open tab redraws itself. It still does not
                           WRITE — capture and check-off in the browser
                           are next. Until then the chat panel is how
                           you change an outline without an editor.

Mirrors fall out of the language for free: a node is a binding,
referencing it twice is a mirror. define-before-use kills most cycles
before they exist.

## SYNTAX

Quoteless outline (flagship). Nest with 2 spaces; attach notes and dates
under a title:

```racket
#lang olai

Inbox #capture
  : Quick capture landing zone
  Buy milk — don't quote me
    @date 2026-08-04T18:00
  [x] Already shipped the pitch
  Wired the CLI
    @done 2026-08-03
```

Titles and notes are Markdown at **render** time (web view only); stored
strings stay raw. Check off with `[x] ` OR `@done` — one node, one of them
(or `olai done TITLE`). Full rules: `docs/syntax.md`.

Under the hood every outline becomes s-expressions. Same expander:

```racket
#lang olai/sexp
(t "Inbox #capture"
   #:description "Quick capture landing zone"
   (t "Buy milk" #:date "2026-08-04T18:00")
   (t "Already shipped the pitch" #:done)
   (t "Wired the CLI" #:done "2026-08-03"))
```

## HOW IT WORKS

```text
$OLAI_HOME/*.rkt                 <- personal data (#lang olai)
(your outline dir; unset -> the repo's examples/ + Roadmap.rkt)
    |                                 ^
    v                                 | edits your files
olai CLI (Racket)                     |   <- validate / query / capture
    |                                 |
    v                                 |
racket web-server --- spawns ---> ACP agent (Claude Code; JSON-RPC on stdio)
    |
    +-- SSE ---> browser (htmx): a file moved, or the agent said something
    |
    +-- PWA: installable (manifest + icons); live view only, no offline shell
```

Personal outlines are plain files you sync however you like (Dropbox,
git, rsync). The repo holds the tool; your data stays outside it — point
`OLAI_HOME` at that directory. Without it the repo serves its own
`examples/` plus `Roadmap.rkt`, and the write commands ask you to set it.
`add` / `done` / `move` / `daily` auto-commit only when the written
file's dir is a git work tree; otherwise they write the file and leave
history to your sync layer.

Single user, many devices. The server runs on your headless box behind
Caddy or Tailscale. Install the web view as a PWA on your phone; it still
needs the network (SSE + agent). Live with it, or open your laptop.

## STATUS

Outline `#lang olai` + sexp core + agent CLI (`check` / `tree` JSON /
`agenda` / `calendar` / `add` / `done` / `move` / `daily` / `ics` /
`serve` / `css`). Done status, mirrors and `@include` composition are first class;
mirrors reach anchors anywhere in the loaded tree, fragments included. The
human view is the web app served by `olai serve` — htmx, no auth (bind
it to localhost or Tailscale). It reloads an outline when the file changes
and pushes that over SSE, so open tabs redraw with no refresh, and it carries
a chat panel driving Claude Code over ACP (`OLAI_ACP_AGENT`). Installable
as a PWA (manifest, icons, theme-color; no offline shell). The page itself
still writes nothing; there is no static HTML export. (Ancestor: srid/Tend.)

## ROADMAP

The project tracks its own plan the same way it wants you to track yours:
`Roadmap.rkt` at the repo root is a `#lang olai` outline, edited and
committed like any other file. `olai tree Roadmap.rkt` (or `just tree
Roadmap.rkt`) gives the JSON view.

Track your own plan as a `#lang olai` outline wherever you like
(`$OLAI_HOME`) — a private `Tasks.rkt` can `@include` the repo's
`Roadmap.rkt` to pull it into your own outline; that's exactly what the
author does. Repo demos live in `examples/` (see `examples/Daily.rkt` for
`@include` composition).

## BUILDING

```bash
nix develop        # racket 9.2 + just; or install them yourself
just install       # gregor + markdown, then --link olai/
just build         # raco setup --pkgs olai (bytecode; test depends on it)
just check         # validates $OLAI_HOME/*.rkt (unset: examples + Roadmap)
just tree examples/Example.rkt   # JSON forest for agents
just serve                       # $OLAI_HOME on http://127.0.0.1:8080
just agenda
just calendar --month 2026-08
just daily                       # today's node in Daily/YYYY-MM.rkt
just test                        # unit tests (in-process; builds first)
just test-integration            # subprocess CLI + servers
just test-all                    # both
just clean                       # drop olai/**/compiled
just css-classes                 # regenerate olai/tests/classes.golden
```

`olai serve DIR` serves `DIR/*.rkt` and runs the agent in `DIR`
(default: `$PWD`; `just serve` passes `$OLAI_HOME`, or names the repo's
own outlines when it is unset). Naming files instead still works — see
docs/cli.md.

`serve` refuses to start without `OLAI_ACP_AGENT` — the path to an
executable speaking the Agent Client Protocol. The Nix package defaults it
to the bundled, pinned Claude Code adapter (`--set-default`); `nix develop`
(hence `just serve`) exports the same. Outside nix, export it yourself.

## CLI (agents)

Machine-readable contract (`--json`, exit codes, `add`): **docs/cli.md**.
No ANSI. Humans use the web app.

## HACKING

**No hand-rolling where a library exists.** Prefer maintained packages
(`racket/cmdline`, `json`, `gregor`, `markdown`, `xml` xexprs,
`web-server` for routing and static files) over home-grown parsers,
routers and escape codes.

Toolchain traps, css-expr spelling, and the stale-`.zo` symptom:
**docs/hacking.md**.

Patches welcome. Keep it small, keep it boring. The interesting part is
the DSL; write good expander error messages -- the agents read them.

## LICENSE

AGPL-3.0. Self-host it, fork it, but keep the network service free.
