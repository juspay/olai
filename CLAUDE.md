# CLAUDE.md

Read README.md and docs/*.md first. This file is only what you can't infer.

## HARD RULES

* Personal outline DATA lives outside the repo: `$SELFFLOWY_HOME`
  (default `~/Dropbox/Selfflowy-Srid/`) — `Tasks.rkt`, `Daily.rkt`,
  `Roadmap.rkt`. NEVER commit those. NEVER invent content for them; treat
  them as user-owned. Re-validate after any edit. `examples/` is demo
  fiction only (including `examples/Roadmap.rkt`); CI uses examples only,
  never Dropbox paths.
* No hand-rolling where a maintained library exists. In use: racket/cmdline,
  json (write-json/read-json), xml (xexprs), gregor (dates), markdown
  (title/note formatting in the web view only).
* No ANSI. Human view is the web app: `selfflowy serve` (routes in
  docs/cli.md; `just serve` / `just run` / `just watch` all launch it).
  Agents use `--json` (and `tree`, which is JSON-only).
* The expander is the ONLY validator (closed grammar). Readers just translate
  to (t ...) forms. Never validate in the reader or at runtime.
* Agents are the primary CLI users: every command gets --json where it makes
  sense; errors are JSON on stderr in --json mode; exit codes are contract
  (see docs/cli.md). JSON fields are append-only within a "version".
* Error messages carry file:line:col of the OFFENDING form. srcloc fidelity
  has tests; keep them passing.
* Markdown is render-time only (web view). Strings in the struct/JSON stay
  verbatim.
* Code organization/review: https://kolu.dev/blog/hickey-lowy/ — separate
  spatial (complected concepts, Hickey) and temporal (volatility mismatches,
  Lowy) passes; ship only when both lenses go quiet.

## LAYERING

* lang/ readers -> lang/expander (t forms, closed grammar) -> task struct
* main.rkt exports data model + pure queries + web render. CLI is app code,
  not library. Pure logic takes `today` as an argument (testable, no clocks).

## WORKFLOW

* just check / tree / agenda / serve / test — recipes handle PLTUSERHOME +
  raco link (`run`/`watch` alias `serve`). Racket comes from the nix dev
  shell (nixpkgs 9.2). Don't fight raco setup; PLTUSERHOME must be writable.
* Small commits, one concern each. Push as you go.
* Other agents work this repo concurrently (Grok in a kolu terminal). git pull
  --rebase before starting; don't assume a clean tree is yours.
* Driving that terminal: `padi-tui status` lists terminals + agent state;
  `padi-tui wait <id> --until awaiting,waiting` blocks until its turn ends.
  `kaval-tui snapshot <id>` reads the screen; to prompt it: `kaval-tui send
  <id> "text"`, pause ~2s, then `kaval-tui send <id> --key Enter` (separate
  sends — same-breath Enter gets eaten by the paste debounce). Long briefs:
  write a file, send a short "read <path>" prompt. Never kill that terminal.
* CI = nix build + binary smoke + just test. Keep `nix build` offline-clean
  when possible; external racket deps (gregor, markdown) need vendoring or
  impure install until fixed-output derivations land.
* Tests parse JSON output with read-json. Never string-match JSON.

## VOICE

* README/docs: terse, dry, 90s hacker. No emoji, no badges, no marketing.
