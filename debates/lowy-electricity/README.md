# What deserves an electricity receptacle in olai? — a three-AI debate

| | |
|---|---|
| **The question** | Argue FOR volatility-based extraction: what in olai deserves a "receptacle" — a stable socket hiding enormous churn, like a wall outlet hides AC/DC, voltage, phase, and source from every appliance? |
| **The frame** | Juval Löwy's *Righting Software* ch. 2 ([the article](https://www.informit.com/articles/article.aspx?p=2995357&seqNum=2)), read in full by every debater. Kolu's own surface framework came out of this thinking. |
| **Debaters** | **fable** (Claude — argued packages) · **opencode** (argued modules/files) · **grok** (argued paying sockets upstream into kolu) |
| **Rounds** | 3 — openings ([01](01.fable.md)·[01](01.opencode.md)·[01](01.grok.md)), rebuttals ([02](02.fable.md)·[02](02.opencode.md)·[02](02.grok.md)), closings ([03](03.fable.md)·[03](03.opencode.md)·[03](03.grok.md)) |
| **Result** | Converged, one trigger's wording left open — full ledger in [`conclusion.md`](conclusion.md) |
| **Date** | 2026-08-12 |

## The answer, in plain words

Everyone argued *for* extraction — and still landed on **zero new olai packages**. Not because extraction lost, but because the debate found the receptacles are mostly already installed. What's missing is on the *other* sides of olai:

> [!IMPORTANT]
> **The three real extractions are upstream, in kolu:**
> 1. **Finish the build helper** so every app stops hand-rolling asset compression and code-splitting (olai then *deletes* its two workaround files — the deletion is the installation).
> 2. **Make the connection light unable to lie** — today the "connected" dot can be green while data has silently stopped arriving, unless the app remembers to double-check. The framework should own that truth; olai keeps its own wording.
> 3. **Take the file-chunking arithmetic** that stops a big upload from killing the whole tab — every app that uploads will need it; it was already copied from kolu once.

Inside olai, the debate ratified two things:

- **`@olai/store` — the package that watches your files — is already the textbook receptacle** (its consumers never see a file-watcher event, a timestamp trick, or a rename dance). Moving it to its own repo waits for a measurable trigger: its public face going untouched for a defined quiet period. The exact fine print has three versions, recorded side by side in the ledger for the human to pick.
- **Module-level sockets get "claim tests"** — tiny automated checks that pin promises like "only one file in the app knows a websocket exists," because such promises are otherwise just comments, and comments rot (both debates caught them rotting).

## Why this debate earned its keep

The first debate ([kitchen-sinks](../kitchen-sinks/)) *prosecuted* a list of proposed extractions down to zero packages. This one argued the opposite direction — extract everything the analogy justifies! — and reached the same zero, plus three upstream findings the first debate never saw. Two debaters also caught and withdrew their own factual errors mid-debate by re-reading the code, including one debater correcting its *own* winning argument's evidence.

> [!NOTE]
> One dissent is preserved: whether the store's future graduation may require a second consumer, or only a proven-still interface. See "the store-incorporation trigger" in [`conclusion.md`](conclusion.md).
