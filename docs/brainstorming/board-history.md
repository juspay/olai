# Where should the board's history live? (master is drowning)

Status: brainstorming, opened 2026-08-16 on the human's problem statement: master's commit history is polluted with roadmap/board commits — ~40 in one day, drowning the code PRs. The human asked for creative ideas, not the four obvious ones (branch / separate repo / batch / filter). Those four are listed at the end for completeness; the interesting ideas come first.

## First, name the actual mistake

The orchestrator narrates every beat into a **git commit message**. That made git the event log of the orchestration — and git commit messages are the *worst-read text in the system*: invisible in the olai UI, unsearchable by olai search, browsable only by someone spelunking `git log`. Meanwhile the vault itself — the thing olai exists to display — holds none of that story.

So the pollution is a symptom. The mistake is **using git as a diary because the vault had no diary**. Every idea below follows from taking that seriously.

## Idea 1 — The beat narration becomes vault content (the orchestrator's journal)

Each beat, instead of (or before) committing, the orchestrator **appends a node to a journal outline** — `journal.olai`, one node per beat, dated, under the day: *"Both reviewers wave #201 through — grok with an empty findings list…"*. Exactly the sentences currently trapped in commit messages.

What this buys, immediately:

- The story becomes **readable where the human already reads** — the olai day page shows the orchestration diary beside the day's finished work, for free (dated nodes already land on the journal).
- It becomes **searchable** (`search_nodes "reviewers wave"`) and **linkable** (`see` edges from a journal entry to the lane it narrates).
- Git commits stop needing to carry the story. They can become terse, **batched checkpoints** — one or two a day — because the audit trail is *in-band* now.

This is the load-bearing idea: once the narrative lives in the vault, the frequency question ("how often to commit?") detaches from the audit question ("where is the trail?"), and every remaining option gets easy.

## Idea 2 — Split the board's files by what their history is FOR

Not all board files deserve the same treatment:

| file | history's value | so |
|---|---|---|
| `roadmap.olai` | real — rulings, items, closures | commit on change; a few meaningful commits a day |
| `Archive.olai` | mild — it is already history | rides along |
| `orchestrator/lanes.olai` | **near zero** — a live scoreboard, reconstructible from PRs + kolu at any moment | maybe never committed at all: gitignored, ephemeral, reborn each morning |
| `orchestrator/agents.olai`, `dag.olai` | real but rare — conventions change weekly, not hourly | commit on change |
| `brainstorming/*.md` | real — arguments and rulings | commit on change |

Most of the day's 40 commits are lanes.olai step-flips. If the scoreboard is ephemeral (its durable residue being the PRs themselves, the roadmap closures, and Idea 1's journal), the commit count collapses **without moving anything anywhere**.

The honest cost: a crash loses the live board's in-flight state — mitigated by the journal (which says what was in flight) and by `kolu ls` (which says what is actually running). The board was always a *view* of reality; this admits it.

## Idea 3 — The daily edition (if the files stay on master)

If the vault stays in the repo, make master's board history *worth reading* instead of hiding it: beats accumulate on a scratch ref, and once a day the orchestrator lands **one commit** on master — a digest whose message is the day's story in ten lines ("merged #201–#206; the crash confessed to #130; the seal rebuilt; grok lost the quiet-outline job"). Master's history then reads as code PRs punctuated by daily editions — arguably *better* than clean, because the narrative survives at a readable grain. This composes with Ideas 1–2: the digest is just the journal's day, quoted.

## Idea 4 — History below git: olai grows per-node memory

The deeper product idea (bigger than this problem, and maybe its real answer): olai nodes already carry `created`/`changed`, and the ops layer already computes inverses for undo. Make that durable — **an append-only op journal per vault** (`.olai-history/` or a JSONL the store writes), giving every node a "what happened to me" timeline the UI could someday show. Then git versioning of the vault becomes *entirely optional* — a backup cadence, not a history mechanism — because history is a first-class olai feature instead of a git side effect. This is the emanote-grade version: the tool owns its own past. (Big; files as a Someday item if liked.)

## Idea 5 — Commits under a ref that isn't a branch

Sneaky-git option: beats commit to `refs/olai/board` (not `refs/heads/*`). The history exists, is pushable and fetchable, never appears in `git log master`, branch lists, or GitHub's UI noise. Zero file moves. Cost: invisible-by-default cuts both ways — tooling must know the ref, and GitHub won't render it. Best as the *scratch ref* for Idea 3's daily edition.

## The four conventional shapes (for completeness)

Board branch as a worktree (same repo, cleanest conventional answer); separate repo (most isolation, most friction); batch on master (less noise, still noise); filter with `--invert-grep` (zero work, master stays polluted underneath).

## Recommended composition

1. **Idea 1 now** — the journal outline. Small change to the orchestrator's beat (append a dated node before committing), immediate value, and it makes everything else easy. The commit message becomes a short label; the sentence lives in the vault.
2. **Idea 2 now** — lanes.olai goes ephemeral (gitignored); roadmap/agents/dag/brainstorming commit only when they actually change. Expected result: ~40 commits/day → a handful, all meaningful.
3. **Then decide** whether the handful still bothers master. If yes, Idea 3's daily edition or the plain board branch finishes the job. If Idea 4 ever ships, git retires from vault-history duty altogether.

## Open questions

1. Idea 2's crash story: is "journal + kolu ls + PRs" really enough to rebuild a lost live board, or does lanes.olai deserve a low-cadence safety commit (say, hourly)?
2. Idea 1's journal grain: one node per beat, or one per lane-event with the beat as a parent? (The day page's readability decides.)
3. Does the deploy vault (the human's personal one) want the same treatment, or is this purely the dev repo's problem?
4. If Idea 4 is liked: is the op journal a store feature (every vault gets it) or an opt-in?

Any direction ruled here becomes roadmap items; this document is the argument, not the ledger.
