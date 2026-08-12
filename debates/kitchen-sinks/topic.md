# Debate: the kitchen-sinks decomposition proposal

**Subject document:** `docs/brainstorming/kitchen-sinks.md` (in this repository) — a survey of accumulated "kitchen sink" modules/packages in olai and a proposal for lifting some to separate packages and splitting others into modules, sequenced in waves.

**Question under debate:** Is that proposal right? What should actually be extracted, split, or left alone — and on what principle?

**Mode:** open-ended exploration, three debaters, assigned stances with a steelman duty. This is not a vote; the goal is to surface the strongest version of each position and any insight none of the positions started with.

## Grounding sources (read before your opening turn)

- `docs/brainstorming/kitchen-sinks.md` — the proposal under debate.
- `docs/architecture.md` — the repo's layering and its arguments (especially the Packages table and the `@olai/git` extraction precedent).
- `HACKING.md` — the binding rules.
- Juval Lowy's volatility-based decomposition, as this project applies it: https://raw.githubusercontent.com/srid/agency/master/.apm/skills/lowy/SKILL.md — the "electricity receptacle" bar: boundaries must encapsulate a NAMED axis of change (likelihood × effect), not merely group related functionality. "Variable is not volatile." This bar binds ALL three stances: every argument for or against a boundary should name (or refute) the volatility axis.
- The package.json `//dependencies` comments across `packages/*` — the repo's own record of why each edge exists.
- The actual source files the proposal cites. Verify claims against the code; a debater who checks `file:line` beats one who argues from the summary.

## Stances

- **fable** (Claude, the document's author): defends the proposal as written — steelmanning it, but obliged to concede any cut that fails Lowy's bar.
- **opencode**: prosecutes the proposal on Lowy's bar. Presumption: most of these cuts are functional decomposition in volatility clothing — file length is not an axis of change, a package for weak volatility is over-engineering, and some proposed splits may destroy invariants that co-location protects. Steelman the proposal before attacking it.
- **grok**: re-frames. Presumption: both other stances argue about the doc's boundaries, but the right decomposition should be re-derived from olai's ACTUAL volatility axes (what has demonstrably changed or is on the roadmap: adapter quirks, git behaviors, wire schema growth, theming, the Workflowy parity work, …) — and the doc's file-size lens may be pointing at the wrong seams entirely. Propose the decomposition YOUR analysis yields, even where it contradicts both others.

## Rules of conduct

- Steelman before rebutting; concede what is genuinely true; forge new insight.
- Cite `file:line` evidence from this repository. Claims about code that don't survive a read of the code are conceded, not defended.
- Each turn is the next file `debates/kitchen-sinks/<NN>.<your-id>.md`. Write ONLY your own turn files. Never edit another debater's file, the subject document, or anything else in the repository. Never run a git command that writes (no add/commit/push); the orchestrator owns the repository.
- Round 1: write your opening from the grounding sources alone. Round k>1: read the other two debaters' round k−1 files first, then reply — engage their specific arguments by name.
