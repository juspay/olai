# CLAUDE.md

THIS FILE IS HAND-MAINTAINED. Agents may correct facts that have drifted, but never ADD to it — a new rule is proposed to the human (or the orchestrator) for ratification, never written as a side effect of other work.

Read [README.md](README.md) and `docs/*.md` first (especially [docs/hacking.md](docs/hacking.md)). This file is only what you can't infer.

## HARD RULES

* Personal outline DATA lives in `$OLAI_HOME` (no default path; unset is a usage error; the repo never names anyone's data dir). NEVER commit or invent it. The repo's public outlines are `docs/olai/` (`Roadmap.rkt`, `Archive.rkt`); `examples/` is demo fiction for CI. Re-validate any outline after editing it.
* No hand-rolling where a maintained library exists. In use: `racket/cmdline`, `json`, `xml` (xexprs), `gregor`, `markdown` (web view only).
* The LANGUAGE is the only validator: `lang/graph` at compile time, over the spliced tree at run time, over the whole loaded SET in `lang/link` (an anchor's scope is the set). Never validate in the reader, the CLI, the store, or the web layer.
* Error messages carry `file:line:col` of the OFFENDING form. srcloc fidelity has tests; keep them passing.
* Module boundaries ship `contract-out` (flat checks, never a tree walk); blame + srcloc are part of the error contract, with tests.
* Raw htmx/SSE attributes in app code are BANNED. The `live/` forms are the only door; a vocabulary gap is PROPOSED to the human, never hand-rolled: [live/README.md](live/README.md#raw-htmx-attributes-are-banned).
* Markdown is render-time only (web view). Stored strings stay verbatim.
* Code review: [kolu.dev/blog/hickey-lowy](https://kolu.dev/blog/hickey-lowy/) — spatial pass, temporal pass; ship when both go quiet.
* Racket style: [notjack.space/racket-skills `racket/SKILL.md`](https://tangled.org/notjack.space/racket-skills/blob/main/racket/SKILL.md) — read before writing `.rkt`. Standing exceptions: internal invariants keep `error` + who: ([olai/fail.rkt](olai/fail.rkt)), and `raco fmt` is not run over this tree.

## LAYERING

* Layering is DECLARED, not described: one `arch.rkt` per package, checked by `just arch`. Read [arch/README.md](arch/README.md) before adding a module, moving one, or arguing with a finding. Fix the code or change the declaration; there are no waivers.
* `lang/` readers -> `lang/expander` -> task struct -> `lang/link` (one anchor index over the loaded set).
* `main.rkt` exports data model + pure queries + web render. CLI is app code, not library.
* Writes live in `ops.rkt` (result struct or `exn:fail:op` naming a kind). `cli.rkt` is a shell. Web mutation routes call the same ops.
* `load.rkt` links the set; `store.rkt` owns snapshots and binds mirror sites; `index.rkt` inverts keys and derives trails ([docs/cli.md](docs/cli.md) for what a key is).
* Live view: store -> `web/watch.rkt` -> `live/hub.rkt`. The chat rides the same hub.
* `olai/acp.rkt` speaks ACP; `web/chat.rkt` makes its events a conversation.
* File naming is `olai/paths` (`file-label`, `key-label`), not a renderer helper.
* JSON is two modules, two version counters: `json/model` (durable) and `json/reply` (envelopes).
* CSS cascade = layer (`'base` | `'component` | `'overlay`) then instantiation order; a class is defined in the module that DRAWS it. No native `@layer`.
* `web/skin.rkt` composes the sheet and owns its URL; `render-page` is TOLD the href.
* Packaging is layering: anything with its own reason to be built is its own package with its own `default.nix`.

## WORKFLOW

* `just check` / `serve` / `test` — recipes handle `PLTUSERHOME` + `raco link`. Racket comes from the nix dev shell. Toolchain facts live in [docs/hacking.md](docs/hacking.md); read it before probing css-expr or the build.
* `just test` is the only test command you run (it builds first; CI runs the rest). Linklet mismatch → `just clean && just build`.
* Branch + PR for every change (agents included); CI green before merge. Master rejects direct pushes.
* CI = [odu SKILL.md](https://github.com/juspay/odu/blob/master/.apm/skills/odu/SKILL.md) (read in FULL), Linux and macOS. Run CI at the end of a PR to satisfy "CI green".
* Tests parse JSON with `read-json`. Never string-match JSON.

## VOICE

* README/docs: terse, dry, 90s hacker. No emoji, no badges, no marketing. The persona is for the English only — full modern Markdown stands.
