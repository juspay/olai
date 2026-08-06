# CLAUDE.md

Read README.md and docs/*.md first (especially docs/hacking.md for the
edit-verify loop and css-expr). This file is only what you can't infer.

## HARD RULES

* If your model is Fable, a) use subagents for implementation (typically
  Opus), b) reserve Fable only where truly necessary.
* Personal outline DATA lives outside the repo, in `$OLAI_HOME` —
  `Tasks.rkt`, `Daily.rkt` (+ `Daily/`). No default path: unset is a usage
  error, and the repo never names anyone's data dir. NEVER commit or invent
  content for these; user-owned, re-validate after edits. `examples/` is demo
  fiction for CI. `Roadmap.rkt` is public, at repo root, committed and
  re-validated like any file — a private `Tasks.rkt` may `@include` it.
* No hand-rolling where a maintained library exists. In use: racket/cmdline,
  json (write-json/read-json), xml (xexprs), gregor (dates), markdown
  (title/note formatting in the web view only).
* No ANSI. Human view is the web app: `olai serve` (routes in
  docs/cli.md; `just serve` / `just run` / `just watch` all launch it).
  Agents use `--json` (and `tree`, which is JSON-only).
* The LANGUAGE is the only validator (closed grammar): one checker
  (lang/graph) runs over a module's syntax at compile time, and over the whole
  spliced tree at run time when it has `@include`s (cross-file anchors exist
  only after the splice). Same rules, same messages, both ways. Readers just
  translate to (t ...) forms. Never validate in the reader, the CLI, the
  store, or the web layer.
* Agents are the primary CLI users: every command gets --json where it makes
  sense; errors are JSON on stderr in --json mode; exit codes are contract
  (see docs/cli.md). JSON fields are append-only within a "version".
* Error messages carry file:line:col of the OFFENDING form. srcloc fidelity
  has tests; keep them passing.
* Module boundaries ship with `contract-out` (flat, cheap checks — never a
  tree walk); blame + srcloc are part of the error contract, and have tests.
* Markdown is render-time only (web view). Strings in the struct/JSON stay
  verbatim.
* Code organization/review: https://kolu.dev/blog/hickey-lowy/ — separate
  spatial (complected concepts, Hickey) and temporal (volatility mismatches,
  Lowy) passes; ship only when both lenses go quiet.

## LAYERING

* lang/ readers -> lang/expander (t forms, closed grammar) -> task struct
* main.rkt exports data model + pure queries + web render. CLI is app code,
  not library. Pure logic takes `today` as an argument (testable, no clocks).
* Writes live in ops.rkt (add/done/move/daily -> result struct, or an
  exn:fail:op naming a kind). cli.rkt is a shell: parse, call an op, render,
  map kind -> exit code. The web mutation routes will call the same ops.
* Node keys are minted in the load layer, not the expander (see docs/cli.md);
  store.rkt owns snapshots and binds mirror sites before anything draws them.
  index.rkt inverts the keys (key -> node + its parent's key) and derives the
  trail above a node on demand — what /n/<key> and its breadcrumbs are drawn
  from. Addressing is not snapshotting: the store builds one index per load
  and asks it nothing.
* Live view: store (what) -> web/watch.rkt (when) -> web/events.rkt (generic
  SSE hub); they meet only in serve.rkt, and the chat rides the same hub.
* olai/acp.rkt speaks ACP: one subprocess, typed events out of one
  handler, no web/. web/chat.rkt makes those events a conversation — one turn
  at a time, chat frames, transcript. Nothing else spells either.
* Core must build without web/: file naming is olai/paths (file-label,
  key-label), not a renderer helper.
* JSON is two modules, two version counters: json/model (what a node/tree IS,
  durable) and json/reply (command envelopes, agenda, calendar).
* CSS cascade = layer ('base | 'component | 'overlay) then instantiation
  order; a class is defined in the module that DRAWS it. No native @layer.
* web/skin.rkt composes the sheet (require order = cascade) and owns its URL;
  render-page is TOLD the href, so nothing downstream requires skin.

## WORKFLOW

* just check / tree / agenda / serve / test — recipes handle PLTUSERHOME +
  raco link (`run`/`watch` alias `serve`). Racket comes from the nix dev
  shell (nixpkgs 9.2). Don't fight raco setup; PLTUSERHOME must be writable.
* `just test` runs `just build` first (`raco setup --pkgs olai`) so
  compiled/*.zo exist and stay coherent after edits. `just install` alone
  does not recompile. Linklet mismatch → `just clean && just build` (see
  docs/hacking.md). Repo-specific facts agents rediscover otherwise live
  in docs/hacking.md — read it before probing css-expr or the toolchain.
* `just test` is the only test command you run. It is the fast set; CI
  runs everything else on the PR.
* Branch + PR for every change (agents included); CI green before merge.
  Master rejects direct pushes.
* Other agents work this repo concurrently (Grok in a kolu terminal). git pull
  --rebase before starting; don't assume a clean tree is yours.
* Driving that terminal: `padi-tui status` lists terminals + agent state;
  `padi-tui wait <id> --until awaiting,waiting` blocks until its turn ends.
  `kaval-tui snapshot <id>` reads the screen; to prompt it: `kaval-tui send
  <id> "text"`, pause ~2s, then `kaval-tui send <id> --key Enter` (separate
  sends — same-breath Enter gets eaten by the paste debounce). Long briefs:
  write a file, send a short "read <path>" prompt. Never kill that terminal.
* CI = nix build + binary smoke + the full test suite. Keep
  `nix build` offline-clean when possible; external racket deps (gregor,
  markdown) need vendoring or impure install until fixed-output derivations
  land.
* Tests parse JSON output with read-json. Never string-match JSON.

## VOICE

* README/docs: terse, dry, 90s hacker. No emoji, no badges, no marketing.
