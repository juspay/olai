# CLAUDE.md

Read [README.md](README.md) and `docs/*.md` first (especially [docs/hacking.md](docs/hacking.md) for the edit-verify loop and css-expr). This file is only what you can't infer.

## HARD RULES

* If your model is Fable, a) use subagents for implementation (typically Opus), b) reserve Fable only where truly necessary.
* Personal outline DATA lives outside the repo, in `$OLAI_HOME` — `Tasks.rkt`, `Daily.rkt` (+ `Daily/`). No default path: unset is a usage error, and the repo never names anyone's data dir. NEVER commit or invent content for these; user-owned, re-validate after edits. `examples/` is demo fiction for CI. `Roadmap.rkt` is public, at repo root, committed and re-validated like any file — a private `Tasks.rkt` may `@include` it.
* No hand-rolling where a maintained library exists. In use: `racket/cmdline`, `json` (`write-json`/`read-json`), `xml` (xexprs), `gregor` (dates), `markdown` (title/note formatting in the web view only).
* No ANSI, no plain mode. Human view is the web app: `olai serve` (routes in [docs/cli.md](docs/cli.md); `just serve` launches it). The CLI is the agent surface and the write-safety layer: every command answers JSON but `ics` (the format IS the reply) and `serve`. `--json` is accepted everywhere it used to be, and does nothing.
* The LANGUAGE is the only validator (closed grammar): one checker (`lang/graph`) runs over a module's syntax at compile time, over the whole spliced tree at run time when it has `@include`s, and over the whole LOADED SET in the linker (`lang/link`) — an anchor's scope is the set, so "unknown `*mirror`" is the linker's rule alone and a module compiles without it. Same rules, same messages, every way. Readers just translate to `(t ...)` forms. Never validate in the reader, the CLI, the store, or the web layer.
* Agents are the only CLI users: replies and errors are JSON (errors on stderr); exit codes are contract (see [docs/cli.md](docs/cli.md)). JSON fields are append-only within a `"version"`.
* Error messages carry `file:line:col` of the OFFENDING form. srcloc fidelity has tests; keep them passing.
* Module boundaries ship with `contract-out` (flat, cheap checks — never a tree walk); blame + srcloc are part of the error contract, and have tests.
* ALL raw htmx/SSE attributes in app code are BANNED — the `live/` forms (or its documented functions) are the only door, and a gap in the vocabulary, write verbs included, is PROPOSED to the human as a new form, never hand-rolled: [live/README.md](live/README.md#raw-htmx-attributes-are-banned).
* Markdown is render-time only (web view). Strings in the struct/JSON stay verbatim.
* Code organization/review: [kolu.dev/blog/hickey-lowy](https://kolu.dev/blog/hickey-lowy/) — separate spatial (complected concepts, Hickey) and temporal (volatility mismatches, Lowy) passes; ship only when both lenses go quiet.
* Racket style: [notjack.space/racket-skills `racket/SKILL.md`](https://tangled.org/notjack.space/racket-skills/blob/main/racket/SKILL.md). Read it before writing `.rkt`. Two standing exceptions, both because something else here is already contract: internal invariants keep `error` and its who: (message text ships to agents, and [olai/fail.rkt](olai/fail.rkt) already owns the who:/no-who: split), and `raco fmt` is not run over this tree (the alignment in the css-expr and theme tables is read as a table).

## LAYERING

* `lang/` readers -> `lang/expander` (`t` forms, closed grammar) -> task struct -> `lang/link` (the set: one anchor index over every loaded file)
* `main.rkt` exports data model + pure queries + web render. CLI is app code, not library. Pure logic takes `today` as an argument (testable, no clocks).
* Writes live in `ops.rkt` (`add`/`done`/`move`/`daily` -> result struct, or an `exn:fail:op` naming a kind). `cli.rkt` is a shell: parse, call an op, render, map kind -> exit code. The web mutation routes will call the same ops.
* Node keys are minted in the load layer, not the expander (see [docs/cli.md](docs/cli.md)); `load.rkt` links the set (keys + the shared anchor index, as one `linked` value) and `store.rkt` owns snapshots and binds mirror sites — against that index, so a mirror reaches another file — before anything draws them. `index.rkt` inverts the keys (key -> node + its parent's key) and derives the trail above a node on demand — what `/n/<key>` and its breadcrumbs are drawn from. Addressing is not snapshotting: the store builds one index per load and asks it nothing.
* Live view: store (what) -> `web/watch.rkt` (when) -> `web/events.rkt` (generic SSE hub); they meet only in `serve.rkt`, and the chat rides the same hub.
* `olai/acp.rkt` speaks ACP: one subprocess, typed events out of one handler, no `web/`. `web/chat.rkt` makes those events a conversation — one turn at a time, chat frames, transcript. Nothing else spells either.
* Core must build without `web/`: file naming is `olai/paths` (`file-label`, `key-label`), not a renderer helper.
* JSON is two modules, two version counters: `json/model` (what a node/tree IS, durable) and `json/reply` (command envelopes, agenda, calendar).
* CSS cascade = layer (`'base` | `'component` | `'overlay`) then instantiation order; a class is defined in the module that DRAWS it. No native `@layer`.
* `web/skin.rkt` composes the sheet (require order = cascade) and owns its URL; `render-page` is TOLD the href, so nothing downstream requires skin.
* Packaging is layering: anything with its own reason to be built — library, example, app — is its own package with its own `default.nix` beside it, never a directory riding along inside another's.

## WORKFLOW

* `just check` / `serve` / `test` — recipes handle `PLTUSERHOME` + `raco link`. Racket comes from the nix dev shell (nixpkgs 9.2). Don't fight `raco setup`; `PLTUSERHOME` must be writable.
* `just test` runs `just build` first (`raco setup --pkgs olai`) so `compiled/*.zo` exist and stay coherent after edits. `just install` alone does not recompile. Linklet mismatch → `just clean && just build` (see [docs/hacking.md](docs/hacking.md)). Repo-specific facts agents rediscover otherwise live in [docs/hacking.md](docs/hacking.md) — read it before probing css-expr or the toolchain.
* `just test` is the only test command you run. It is the fast set; CI runs everything else on the PR.
* Branch + PR for every change (agents included); CI green before merge. Master rejects direct pushes.
* CI = https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md (read this in FULL) run on both Linux and macOS. You must run CI at the end of a PR, in order to satisfy "CI green"
* Tests parse JSON output with `read-json`. Never string-match JSON.

## VOICE

* README/docs: terse, dry, 90s hacker. No emoji, no badges, no marketing. But you must respect modern file formats (Markdown -- full syntax) and such. The 90s hacker persona is for writing English only, not going back to caveman days.
