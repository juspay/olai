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

## HOW IT WORKS

    ~/tasks/*.rhm-ish files          <- source of truth (#lang selfflowy)
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

Vaporware. README first, code next. (Ancestor: srid/Tend, same idea in
Lean. The web layer is why it's Racket now.) Classic s-expressions over
Rhombus for `#lang selfflowy`.

## ROADMAP

Weekend-sized phases. Every phase leaves the tool USABLE -- if the
project dies at any line below, what exists still works.

    0.1  the language      #lang selfflowy + `selfflowy check`; render
                           tree to terminal. Usable today with $EDITOR,
                           Claude Code, and git. No server.
    0.2  mirrors & dates   references resolve, cycles rejected, date
                           literals; `selfflowy agenda` in the terminal.
    0.3  capture           `selfflowy add "buy milk"` appends to the
                           inbox file; auto-commit. Bind it to a hotkey.
    0.4  the agent         minimal HTTP server whose only page is a chat
                           panel driving Claude Code over ACP, plus a
                           crude tree dump. Talk to your outline from
                           any browser. Ugly on purpose.
    0.5  the outline       real read-mostly view: collapse, zoom,
                           breadcrumbs; SSE pushes updates when files
                           change (agent edits appear live).
    0.6  micro-edits       capture box + check-off from the browser.
                           The phone loop closes: capture, complete,
                           ask the agent for everything else.
    0.7  PWA               manifest + service worker; offline reading,
                           background-sync capture queue.
    0.8  calendar          agenda & calendar views over date literals.
    0.9  search            plain text search + keyboard nav.
    1.0  daily driver      when the author stops opening Workflowy.

## BUILDING

    nix develop        # or: install racket >= 9.2 yourself
    raco pkg install --auto selfflowy/   # someday
    selfflowy check ~/tasks

## HACKING

Patches welcome. Keep it small, keep it boring. The interesting part is
the DSL; write good expander error messages -- the agents read them.

## LICENSE

AGPL-3.0. Self-host it, fork it, but keep the network service free.
