# architecture as data (brainstorm)

Status: brainstorm. Nothing built. Scope verdicts settled 2026-08-06: everything at once (deps + authorities + concept exclusivity + churn-lie), package defaults with per-module overrides, NO waivers, runs locally (`just arch`) and as a CI lane. Sibling of [live-dsl.md](live-dsl.md) — same doctrine, one level up: the DSL checks names that cross files; this checks edges that cross modules. Everything in [agents-and-dsls.md](agents-and-dsls.md) applies.

## The disease, quoted

CLAUDE.md, today — architecture as sentences nothing enforces:

> * Core must build without `web/`
> * `olai/acp.rkt` speaks ACP: one subprocess, typed events out of one handler, no `web/`
> * they meet only in `serve.rkt`
> * Pure logic takes `today` as an argument (testable, no clocks)
> * Node keys are minted in the load layer, not the expander

Break any of these and the build stays green. An agent finds out in review, or never.

## The declarations

One `arch.rkt` per package sets defaults; a module carries an override only when it differs. `#lang olai/arch` is a closed grammar with srcloc'd errors, like everything else here.

```racket
;; olai/lang/arch.rkt — the grammar: changes are deliberate and rare
#lang olai/arch
(clock stable)
(owns)                       ; no ambient authority: no clocks, no I/O

;; olai/web/arch.rkt — drawing: churns with every feature
#lang olai/arch
(clock volatile)
(owns)                       ; drawing is pure; the exceptions declare themselves:
(override "watch.rkt"  (owns filesystem-events))
(override "serve.rkt"  (clock volatile) (owns network clock))

;; olai/arch.rkt — the core
#lang olai/arch
(clock settling)
(owns)
(override "store.rkt"  (owns filesystem))
(override "acp.rkt"    (owns subprocess))
(override "cli.rkt"    (owns clock))     ; `today` is computed HERE, passed down

;; live/arch.rkt — the framework olai consumes
#lang olai/arch
(clock stable)
(owns)
(override "hub.rkt" (owns threads))
```

Closed vocabularies, human-ratified like DSL forms: `clock ∈ {stable, settling, volatile}`, `owns ⊆ {clock, filesystem, filesystem-events, network, subprocess, threads, randomness}`. A new authority is a roadmap proposal, not an edit.

## The checks

One walker over `module->imports` + declarations. Errors in the house format: srcloc, rule, fix.

**1. Dependencies point volatile → stable, never back:**

```
olai/lang/expander.rkt:14: requires olai/web/render.rkt: dependency points the wrong way
  lang/ is declared stable; web/ is declared volatile
  stable code must not depend on volatile code — invert the edge or move the code
```

This one check IS "core must build without web/", "acp has no web/", and "they meet only in serve.rkt" (serve is declared volatile; it may import everything — nothing may import it).

**2. Authority used only where owned:**

```
olai/index.rkt:52: (current-date): ambient authority `clock` is not owned here
  clock is owned by: olai/cli.rkt, olai/web/serve.rkt
  pure logic takes `today` as an argument — or the declaration changes, in review
```

This IS "pure logic takes today as an argument", checked. Detection: a curated table of authority-bearing identifiers (`current-date`, `open-input-file`, `subprocess`, `thread`, …) matched against each module's expanded imports/references.

**3. Concept exclusivity — one owner per tagged concept:**

```racket
;; the declaration, on the owner:
(concept node-key-minting)     ; olai/load's arch entry
```

```
olai/web/render.rkt:212: mint-key*: exports into concept `node-key-minting`
  that concept is owned by olai/load.rkt (olai/arch.rkt:9)
  one owner per concept — require it from the owner instead
```

This IS "node keys are minted in the load layer", and the pattern behind "one line-grammar owner", "one graph checker", "nothing else spells either".

**4. Churn-lie — declarations audited against git:**

```
arch: olai/web/skin.rkt declared stable, changed in 9 of the last 30 master commits
  either the code settles or the declaration changes — both are reviewable diffs
```

Pure history read, no judgment call in the checker. No waivers anywhere, by verdict: the only responses to any of these four are *fix the code* or *change the declaration* — both visible in the PR diff, both reviewable.

## What dies in CLAUDE.md

| prose rule (today) | replaced by |
|---|---|
| Core must build without web/ | check 1 |
| acp.rkt: no web/ | check 1 |
| store/watch/hub meet only in serve.rkt | check 1 |
| Pure logic takes `today`, no clocks | check 2 |
| Keys minted in the load layer | check 3 |
| "Nothing else spells either" (acp/chat) | check 3 |

Per the research (agents-and-dsls.md, conclusion 5): checked rules get DELETED from the prose, not restated.

## Mechanics

- `just arch`: expand-free walk over `compiled/` dependency info + the arch files. Target: same cost class as `just check` (~seconds), so it lives in the edit loop, not just CI.
- CI: one lane, both platforms, required like the rest.
- The checker is itself a DSL, so it plays by the DSL rules: tested error messages, dumpable state (`just arch --explain FILE` prints a module's effective declaration after defaults + overrides), tiny curated vocabulary.

## Open questions

**Does `just arch` gate `just test`?** Probably not — different failure class, and the edit loop stays fast. CI requires both. Undecided.

**First lie found wins?** Running the churn audit on day one will flag existing modules whose real volatility disagrees with any plausible declaration. The honest bootstrap: declare what git says, not what we wish, and tighten deliberately.

**Granularity of `settling`.** Three clocks may be one too many or one too few — decide from the bootstrap data, not in advance.
