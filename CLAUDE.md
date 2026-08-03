# CLAUDE.md

Read README.md and docs/*.md first. This file is only what you can't infer.

## HARD RULES

* Tasks.rkt is the user's PRIVATE data. gitignored. NEVER commit, never
  overwrite without re-validating. The committed dogfood copy is
  examples/Roadmap.rkt.
* No hand-rolling where a maintained library exists. In use: racket/cmdline,
  json (write-json/read-json), xml (xexprs), gregor (dates), ansi-color.
* The expander is the ONLY validator (closed grammar). Readers just translate
  to (t ...) forms. Never validate in the reader or at runtime.
* Agents are the primary CLI users: every command gets --json, errors are JSON
  on stderr in --json mode, exit codes are contract (see docs/cli.md).
  JSON fields are append-only within a "version".
* Error messages carry file:line:col of the OFFENDING form. srcloc fidelity
  has tests; keep them passing.
* ANSI only when stdout is a TTY, and only via selfflowy/style. One styling
  point.

## LAYERING

* lang/ readers -> lang/expander (t forms, closed grammar) -> task struct
* main.rkt exports data model + pure queries + render only. CLI is app code,
  not library. Pure logic takes `today` as an argument (testable, no clocks).

## WORKFLOW

* just check / tree / agenda / test — recipes handle PLTUSERHOME + raco link.
  Racket comes from the nix dev shell (nixpkgs 9.2). Don't fight raco setup;
  PLTUSERHOME must be writable.
* Small commits, one concern each. Push as you go.
* Other agents work this repo concurrently (Grok in a kolu terminal). git pull
  --rebase before starting; don't assume a clean tree is yours.
* CI = nix build + binary smoke + just test. Keep `nix build` offline-clean:
  external racket deps (gregor) stay out of the nix build path until vendored.
* Tests parse JSON output with read-json. Never string-match JSON.

## VOICE

* README/docs: terse, dry, 90s hacker. No emoji, no badges, no marketing.
