# Should olai split its big files into packages? — a three-AI debate

| | |
|---|---|
| **Subject** | [`docs/brainstorming/kitchen-sinks.md`](../../docs/brainstorming/kitchen-sinks.md) — a survey proposing package extractions and file splits |
| **Debaters** | **fable** (Claude — wrote the survey, defended it) · **opencode** (prosecuted it) · **grok** (re-derived the boundaries from scratch) |
| **Judge/frame** | Lowy's volatility rule: a boundary earns its keep only if it wraps something that *actually changes* behind an interface that doesn't |
| **Rounds** | 3 — openings ([01](01.fable.md)·[01](01.opencode.md)·[01](01.grok.md)), rebuttals ([02](02.fable.md)·[02](02.opencode.md)·[02](02.grok.md)), closings ([03](03.fable.md)·[03](03.opencode.md)·[03](03.grok.md)) |
| **Result** | Converged — the full agreed ledger is in [`conclusion.md`](conclusion.md) |
| **Date** | 2026-08-12 |

## What happened, in plain words

The survey said: some files in this codebase have grown huge and mixed-up, so let's move four chunks out into their own packages and split a dozen files. The debate tested every one of those ideas against a simple bar: **does this boundary wrap something that really changes, or does it just group code that looks alike?**

> [!IMPORTANT]
> **The headline: zero new packages survived.** All four proposed package extractions died on the evidence — one targets a file already scheduled for deletion, one bundles two unrelated concerns, one would extract the *stable* half of its subsystem and leave the changing half behind, and one inverts the direction every existing test-fixture package in the repo follows.

What survived instead is a short, sharp list of moves that each wrap a *real* axis of change:

1. **Fix two dishonest code comments** that under-count how many modules other packages actually import.
2. **Move one misfiled file** (a design-token table living in the markdown folder) next to the theme it belongs to.
3. **Move one shared shape (`GitState`) down to the "floor" package** both sides already stand on — killing a hand-maintained duplicate.
4. **Pull the AI-adapter-specific logic out of the 1,100-line chat session file** into one testable module — including the safety-critical rule that stops the AI from silently approving its own permissions.
5. **Keep growing the existing keyboard-verbs union** — that work is already in flight and *is* the decomposition.
6. Make tool descriptions **read from the policy code they describe**, so they can't silently drift out of date.
7. **Fix the slow-compression bug in place** and delete that file when the upstream framework absorbs the job.

Everything else: leave it alone, or move it casually the next time a PR happens to be in that file — never as a scheduled "refactoring program."

## Why this debate was worth having

The debaters caught **five factual errors** in the survey (and two in each other) by checking the actual code — including a false claim about who tests what, and a missed roadmap item that reversed one recommendation entirely. And one debater ran an experiment that anchored the whole discussion: the repo's one prior extraction (`@olai/git`) has **never needed a single edit** since it was cut, while the policy file above it changed in every git-related PR since. That's what a good boundary looks like — and none of the four proposed packages would have looked like that.

> [!NOTE]
> One dissent is preserved in the ledger: how exactly tool descriptions should be tied to the policy they describe (source-from-structures vs. generate). See "Registered objection" in [`conclusion.md`](conclusion.md).
