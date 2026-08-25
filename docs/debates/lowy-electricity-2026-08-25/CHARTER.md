# Lowy-electricity debate, fourth sitting — 2026-08-25

## The question (the human's focus for this run)

Today the vault shipped typed properties (#395) and then broke four ways in one afternoon. What volatility, had it been behind a receptacle, would have made each of these bug CLASSES **impossible** — not caught earlier, not fixed faster: structurally impossible? Argue extraction candidates through Löwy's four tests at your assigned altitude; a candidate that merely would have *caught* a bug is a guard test, not a receptacle, and belongs in your closing's small-findings list, not your headline.

## The bug harvest (all filed on roadmap/bugs.olai today — read the nodes, then the code)

1. `cold-boot-all-or-nothing` — two long-dangling `see` edges in features.olai made a COLD server serve NOTHING (chat included); the same edges had been tolerated silently by the RUNNING server for days. Two lifecycle paths, two validity policies.
2. `stale-set-reads-clean-writes-refuse` — a `git pull --rebase` replaced files on disk; the running server missed it, served the stale set errorlessly for 30+ minutes, refused every write; touch and append didn't wake it; the 60s poll backstop didn't catch it.
3. `broken-file-blocks-healthy-writes` — one invalid file freezes the whole vault's write surface ("would leave the outlines invalid"), including writes to healthy files; the refusal doesn't even name the broken file.
4. `last-good-banner-flood` — a broken file's ~135 validator rows inline at the top of EVERY page.
5. The `typed-chips-doors` family — `props/door.ts` re-derives "what does this value name" by shape-guessing, blind to `_olai/Properties.olai`: paths resolve beside the writing file while the board writes root-relative (every `brief` chip dead), ref faces show raw ids, a declared `doc` adds nothing to the display.

Also in evidence: the 2026-08-25 incident node (`incident-vault-restart-2026-08-25`, orchestrator/lanes.olai) for the full chain, and `docs/brainstorming/typed-properties.md` for what #395 deliberately built.

## Seats

- **fable** — Claude Fable (the orchestrator): NEW OLAI PACKAGES altitude.
- **grok** — Grok: UPSTREAM-INTO-KOLU altitude (`@kolu/surface` and friends).
- **pi** — pi/kimi-k3: MODULE BOUNDARIES inside existing packages altitude.

## The bar

Juval Löwy, *Righting Software* ch. 2 (https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2) — read in full before your opening; the lowy skill (https://github.com/srid/agency/blob/master/.apm/skills/lowy/SKILL.md) is the bar; the debate skill (https://github.com/srid/llm-debate/blob/master/.apm/skills/debate/SKILL.md) governs conduct. EVERY candidate passes the four tests explicitly: the opaque socket, functional-but-not-domain-functional, the oscilloscope (what actually churned — cite commits/bugs), the vault (would the next change of this kind land inside without touching consumers). House record: three sittings, zero new olai packages — the bar is real; "busy ≠ volatile" killed candidates before.

## Format

Three rounds — openings (`<seat>-r1.md`), rebuttals (`<seat>-r2.md`, engage the other two by name), closings (`<seat>-r3.md`, verdicts + withdrawals). Turn files in THIS folder only (it is git-ignored working material). Debaters never edit board files, product code, or anything outside this folder; read anything. Corrections of your own prior claims are the house's most-prized move. fable drafts README.md (the conclusion) after closings; the human ratifies before it is filed to docs/lowy-electricity/debate-2026-08-25.md or anything is dispatched.
