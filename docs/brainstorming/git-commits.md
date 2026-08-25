# Committing changes

Status: SHIPPED, 2026-08-10 (proposed and built the same day). AMENDED by `commit-whole-repo` (2026-08-12), which is marked inline below: the scope became the whole repository, a commit became a selection, and push arrived.

Every op used to commit itself (`packages/ops/src/git.ts`), so one train of thought became a dozen commits — a roadmap gardening session produced eleven, each with a full node title as its subject line. That is now a commit somebody asks for: a button in the UI, or a tool the agent calls.

## Why olai touches git at all

There are two writers today: the **chat agent** and **MCP**. There is no web editor yet — `self-edit` has not shipped, and `ops.ts` says as much in passing ("the web UI's own ops procedures, *when they arrive*").

So every write olai makes is a write you did not type, and chat auto-approves its ops. Git is how you see what the tool did to your files. That is the one job: **an audit trail of what olai wrote.**

It is not for history (the descs carry their own dates), not for undo (the `undo` item plans real op inverses), and not for sync — though `commit-whole-repo` did give it a PUSH, because an audit trail on one machine is one disk failure from not existing. Sharing what was recorded is not merging it: there is no pull, no fetch and no branch UI.

## How it works

Writes land on disk immediately, through the store's existing gate. They wait to be committed. Two doors to the same action:

- **A Commit button**, for you.
- **A `commit` MCP tool**, for the agent — it knows where its work ends and why, so its message can say `olai: reconcile roadmap with the #70–#81 merges`.

An automatic mode stays available for someone running olai headless with no browser to press anything, but it is off unless asked for.

Nothing is ever `--amend`ed. Amending rewrites history, which is a trap once a commit has been pushed.

## The button

It lives beside the connection dot and the agent pill — the sidebar's footer on every page that draws a sidebar, a corner of the viewport on the ones that do not. That is the pair the bottom-right chrome strip `panels` is building will be made of; the strip itself does not exist yet, and this did not wait for it.

**It is always there, and every state has a face.** (Corrected 2026-08-10, human: the proposal said "nothing pending, nothing shown", and that was wrong.) The reasoning is the whole reason this feature exists: if the job is an audit trail of what the tool wrote, then *there is no audit trail here* is the single most important thing the pill can say, and hiding it is exactly how a person would never find that out. Same argument as the connection dot, which stays green while it is healthy rather than disappearing — an indicator that is only present when something is wrong cannot be trusted when it is absent.

| state | face |
|---|---|
| work tree, clean, has committed before | `✓ committed · 12m ago` |
| work tree, clean, never committed | `no commits yet` |
| work tree, N pending | `4 uncommitted` |
| mid-rebase / merge / cherry-pick / detached | `⚠ 4 uncommitted` + the reason |
| not a work tree | `no git here` — dim, inert |
| `--commit=off` | `commits off` — dim, inert |
| the page has not heard from the server yet | `…` — dim, inert |

The two settings are **settings, not faults**: dim, inert when pressed, and no warning colour. `⚠` is reserved for the busy-repo case, because that is the only one a person can act on.

The last row is not a state of the DIRECTORY at all — it is this page before its first frame. It is drawn separately because the value a page holds before it has heard anything reads as `commits off`, which is a setting somebody could go and change: claiming that about a server nobody has heard from is the same kind of lie as `✓ committed` in a directory olai has never written to.

```
                                    ┌──────────────────────────┐
                                    │  4 uncommitted        ▲  │
                                    └──────────────────────────┘
```

Opened:

```
┌─ Changes ─────────────────────────────────┐
│ olai: Outlines as a collection done       │
│   · chat agent · 12m ago · 1a2b3c4        │
│                                           │
│ OUTLINES ─────────────────────────────    │
│ ☑ roadmap.jsonl                           │
│   ✓  Outlines as a collection    done     │
│   ✎  Notes: one state, same line  note    │
│   +  Kolu integration: auto-…    created  │
│   ⌦  Outlines as a collection    archived │
│                                           │
│ OTHER FILES ──────────────────────────    │
│ ☑ README.md                    modified   │
│ ☐ notes/scratch.md            untracked   │
│                                           │
│ whole repository · olai serves docs/      │
│ chat agent 3 · you 1                      │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ olai: reconcile roadmap with the      │ │
│ │ #70–#81 merges                        │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ 2 commits not on origin/master   [ Push ] │
│         [ Commit 4 changes · 1 file ]     │
└───────────────────────────────────────────┘
```

The LAST COMMIT is at the top, above everything waiting, because the two are one question asked twice: what is waiting says nothing about whether anything was ever recorded, and a directory olai has never committed in has exactly the same empty pending list as one it committed a minute ago.

When the repository is mid-rebase, mid-merge, mid-cherry-pick or on a detached HEAD, the button says so instead of quietly doing nothing:

```
│  ⚠ a rebase is in progress — finish it first │
│                         [ Commit 4 changes ] │   ← disabled
```

Not a work tree, or `--commit=off`: the pill still says so, and pressing it does nothing — there is no panel behind it, because there is nothing to put in one.

## The data model

**One rule: derive it from git, store nothing.** Same discipline as node status and blockedness. Anything we cached would be a second answer to a question git already answers, and it would be wrong the moment you edit a file in vim.

The vocabulary lives in `@olai/format` — `changes.ts` for the comparison, `committing.ts` for the values it travels in. Not because either is about the outline FORMAT, but because that package is the floor both `@olai/ops` (which produces these) and `@olai/surface` (which carries them) stand on, exactly as `OpFailure` already does. Ops may not depend on the surface — an op does not know it is being called over a wire — and the surface may not depend on ops, because the browser imports the surface and `git.ts` shells out to a subprocess.

### What changed, in olai's words

Never show a text diff. A `.jsonl` diff is one enormous line per node with everything on it changing at once. The unit is a node:

```ts
type NodeChange = {
  readonly file: string      // root-relative; where it IS, or where it was
  readonly id: string
  readonly title: string     // as it reads now; as it read at HEAD when removed
  readonly fields: ReadonlyArray<Field>   // empty for one that arrived or left
  readonly sort: Sort
}

// The record's own field names, derived from the schemas rather than listed
// again: parent, ord, title, done, doing, date, desc, doc, after, blocks,
// see, mirror — plus `file`, the one difference that is not a field at all.
type Field = string
```

There is no added/removed/changed tag beside `sort`, and the proposal's one was dropped rather than shipped: it is a function of `sort` (`created` is an arrival, `gone` is a departure, everything else is neither) said in a second vocabulary, and every consumer switches on `sort`. `fields` is empty for the two arms where the answer would be "all of them" and mean nothing.

`Field` is not a literal union either. The members are the record schemas' own field names, taken from them rather than written out again — a hand-kept copy is the one mistake this comparison cannot survive, because the next field the format grew would simply never be compared, and a node whose only change was that field would report as unchanged. A silent hole in the audit trail, with no test to fail.

`sort` is the one thing the change is mostly ABOUT — `created`, `archived`, `done`, `undone`, `moved`, `noted`, `renamed` — and it is on the change rather than derived at render time, which is the one deliberate departure from the proposal. Two of the arms cannot be told apart by a field name: a `done` that appeared and a `done` that was taken off are the same field and opposite events. Classifying once, on the server, where both sides of the comparison are in hand, is what lets every consumer keep a flat table — the panel says *marked done*, the commit body says `done:` — and it is what fixes the priority order in one place (`Sort`'s own declaration is the order).

The comparison is by ID ACROSS FILES rather than within one, so archiving reads as one change to one node — it left `roadmap.jsonl` and is in `Archive.jsonl` — rather than as a removal and an unrelated arrival. That is what `Field`'s `file` is for, and archiving is the only op that produces it.

### Is the repository free?

```ts
type RepoState =
  | { readonly _tag: "Off" }
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Ready";   readonly branch: string }
  | { readonly _tag: "Blocked"; readonly reason: Reason; readonly said: string }

type Reason = "merge" | "rebase" | "cherry-pick" | "detached"
```

`Off` is the fourth arm the proposal did not have: `--commit=off` has to be visible somewhere, and a mode is exactly a thing the repository can be in as far as everything above is concerned. It draws like `NoRepo` — dim and inert, and saying which of the two it is.

This is what drives the disabled button and its explanation. It is also the check `git.ts` was missing — it asked only whether the directory is a work tree. The in-progress states are read off the git directory (`MERGE_HEAD`, `rebase-merge`, `rebase-apply`, `CHERRY_PICK_HEAD`) BEFORE the branch is asked for, because a rebase also leaves a detached HEAD and "detached" is the less useful half of that truth.

### What is pending

```ts
type Pending = {
  readonly repo: RepoState
  readonly changes: ReadonlyArray<NodeChange>
  readonly unreadable: ReadonlyArray<string>   // dirty files we cannot parse
  readonly wrote: ReadonlyArray<{ readonly writer: Writer; readonly ops: number }>
  readonly message: string                     // composed suggestion
  readonly last: LastCommit | null             // what olai last recorded here

  // commit-whole-repo:
  readonly outlines: ReadonlyArray<DirtyOutline> // {file, path, how} — the groups
  readonly others: ReadonlyArray<Other>          // {path, how} — every other dirty file
  readonly served: string                        // '' at the root, 'docs/' inside one
  readonly unpushed: Unpushed | null             // {upstream, commits}; null = no upstream
}

type How = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
```

`How` is GIT's word, not the person's: an unstaged `mv a b` is a `deleted` and an `untracked`, because that is what `git status` reports until both halves are staged. `renamed` shows up once they are.

**The wire GREW required fields** with `commit-whole-repo` — `Pending` gained `outlines`, `others`, `served` and `unpushed`, `CommitResult.Committed` gained `others`, and `PushResult` is new — and none of it is optional. That is allowed here and would not be elsewhere: olai ships as ONE binary, so the client and the server that answers it are the same build. An old page against a new server is not a supported pair, and the framework's own handshake is what a mismatched tab meets first.

```ts
type LastCommit = {
  readonly sha: string
  readonly message: string
  readonly writer: Writer | null    // from the trailer
  readonly at: string               // ISO 8601; the phrase is the reader's clock
}

type Writer = "chat-agent" | "mcp" | "web"
```

`last` is `git log -1` through the same filter the audit view uses — the `olai` message prefix — so it is the last commit OLAI made, never the repository's HEAD: a person's own commits are not what this feature reports on. It was also restricted to the served directory, and `commit-whole-repo` lifted that with the survey: a commit that recorded a dirty root `README.md` and nothing under `docs/` is olai's own work, and hiding it would leave the panel saying nothing was ever recorded here a second after it recorded something. The trailer is what says who; a commit carrying the prefix without one (typed by hand, or stripped by a rebase) reports `writer: null` rather than a guess.

**The `null` is load-bearing.** It means olai has never committed in this directory, which is a different fact from "nothing is waiting" and cannot be derived from it — and telling a directory olai has never touched that it is `✓ committed` would be a lie. Same reasoning as the manifest cell's `null`: "never" is a state an empty value cannot express.

`changes` comes from git: ask `git status --porcelain -z -uall` which served files are dirty, read each one's committed version with `git show HEAD:<file>`, parse that with the codec we already have, and compare it against the store's own last-good parse of the working copy — which is the same bytes the probe published to the page, so the panel and the outline can never disagree about what a file says.

A file that will not parse on either side is listed in `unreadable` and dropped from BOTH sides of the comparison. Keeping the half that parsed would report every node in it as created, or every node in it as gone: a screen of alarming changes with one real cause.

Cost is bounded by what is dirty. A clean directory is one `rev-parse`, one `git status` and no parsing at all.

> **Amended by `perf-git-per-write`.** "Bounded by what is dirty" was the wrong bound, and the roadmap node that says so names the one place this design was actually wrong: under manual commit the dirty list only GROWS through a session, so a keystroke in one outline paid a `git show` and a full parse for every outline anybody had touched since the last commit — typing got slower the longer a commit was deferred. The fix is an observation the design already contains and did not use: a commit's copy of a file cannot change. It is asked for as `<sha>:<path>` rather than `HEAD:<path>` — an immutable object rather than a moving question — and remembered under that pair (`ops/src/committed.ts`), so HEAD moving is a different KEY rather than an invalidation somebody has to remember to call. The bound is now what CHANGED this revision: one `rev-parse` for the commit, and a read only for an outline that has just become dirty.

**Only `.jsonl` outlines.** They are the only files olai writes — there is no op that writes a document — so a served `.md` somebody edited, a source file, and a half-staged patch in the same working tree are all somebody else's work and are never named on `add` or `commit`.

> **Amended by `commit-whole-repo`.** That rule was filed as a bug the moment somebody edited a `.md` by hand: `git status` had already surveyed the file, and the panel dropped it one line later, so the UI said nothing was pending while the working tree said otherwise. The scope is now the WHOLE REPOSITORY, in two kinds of row — served outlines keep their node-level changes, and every other dirty file (documents, source files, an outline outside the served root, untracked files `.gitignore` does not cover) is a path and a status letter, because the only richer thing available is the text diff this feature has never shown. What replaces "only outlines" as the safety property is that a commit names a SELECTION and never touches git's index: exactly the paths asked for, so the half-staged patch above is still exactly as its author left it, and anything left out stays waiting.

### Who wrote it — intent, not truth

`wrote` cannot come from git; git only knows the bytes moved. It is a per-writer COUNTER the ops layer bumps on every write that lands and clears on a successful commit. The proposal drew a richer record (each op's summary, its ids, its timestamp); nothing reads any of that — the panel says "chat agent 3 · you 1" — so it is not kept.

This is a **decoration on the git-derived truth, never a replacement**. It is empty after a restart, and it knows nothing about edits made outside olai. Both are fine: the panel then shows the changes with no writer beside them. Nothing downstream may assume it is complete.

The commit itself records the writer permanently, as a trailer:

```
X-Olai-Writer: chat-agent
```

Commits otherwise take the repository's own name and email, so without this an agent's edits are indistinguishable from yours — which would defeat the point. The trailer is written into the message rather than passed as `--trailer`: it is the same bytes, readable by `git log --format=%(trailers:key=X-Olai-Writer)`, with one less thing to depend on a git version for.

### Asking for a commit

```ts
type CommitRequest = {
  readonly message?: string                    // omitted → composed
  readonly paths?: ReadonlyArray<string>       // omitted → everything (commit-whole-repo)
}

type CommitResult =
  | { readonly _tag: "Committed"; readonly sha: string
      readonly changes: number; readonly others: number }
  | { readonly _tag: "NothingToCommit" }
  | { readonly _tag: "Blocked";   readonly repo: RepoState }
  | { readonly _tag: "Failed";    readonly said: string }

// commit-whole-repo. Same four shapes, because it is the same kind of act.
type PushResult =
  | { readonly _tag: "Pushed"; readonly upstream: string; readonly commits: number }
  | { readonly _tag: "NothingToPush" }
  | { readonly _tag: "Blocked"; readonly repo: RepoState }
  | { readonly _tag: "Failed";  readonly said: string }
```

Both doors — the button's procedure and the MCP tool — call the same thing, added beside `run` and `read` on `Ops`:

```ts
readonly pending: Effect.Effect<Pending>
readonly commit: (
  request: CommitRequest,
  writer: Writer,
) => Effect.Effect<CommitResult>
```

Neither has an error channel, which the proposal gave them. Every way they can go wrong is a value a reader is entitled to see — no repository, a busy one, a set that never loaded — and an error would blank the panel instead of explaining it.

`writer` is a required argument rather than something a transport can claim about itself: `serve.ts` passes `chat-agent` to the internal MCP route, `mcp/serve.ts` passes `mcp` to the stdio one, and the surface procedure is `web`.

Only the dirty served outlines are staged, named explicitly on both `add` and `commit`, exactly as before — a served directory is a working tree with other work in it.

> **Amended by `commit-whole-repo`.** The naming survives and the narrowing does not: a commit names exactly the paths it was asked for — the panel's ticks, or the tool's `paths` — out of everything dirty in the repository, and a path nothing is waiting on is refused by name rather than quietly dropped. olai still never touches the index.

### Where it is computed

`pending` is a surface cell on two clocks: every published revision, and a slow sweep of its own. The revision is the one that matters — a write olai made and a file you saved in vim both arrive as one. The sweep is there because **nothing watches `.git`**: committing in a terminal changes what is pending without changing one served byte, and the panel would otherwise go on offering to commit what is already committed. The cell carries an `equals`, so a sweep that finds nothing new sends nothing.

A commit is the third trigger and is explicit: the procedure republishes the cell the moment it is done, for the same reason.

The git plumbing is [`/git`](../../packages/git/README.md) and decides nothing. (It was `ops/git.ts`; `commit-whole-repo` moved it out into a leaf package on `effect` alone, which is also the answer to "should olai take a git library" — see that README.) Its socket is `open(root)`, answering with a `Repo` handle — `state`, `dirty`, `show`, `last`, `commit`, `push` — or with `NoRepo` for a directory that is not a work tree, or `Unusable` for a git that ran and could not answer. WHERE the served directory sits in the repository (the git directory, and what the root is called from the repository root) is asked once when the handle is opened and belongs to the handle: git speaks repo-relative paths, everything above speaks served-root-relative ones, and a consumer that had to carry that around would be a consumer the volatility had leaked into. Comparing two parsed sets is pure and lives beside the format, with no git in it.

### The same function serves history

A history entry is the same derivation with different inputs: **pending is HEAD against the working tree; a past change is a commit against its parent.** One comparison function, two callers.

```ts
type Change = {
  readonly sha: string
  readonly message: string
  readonly writer: Writer | null    // from the trailer
  readonly at: string
  readonly changes: ReadonlyArray<NodeChange>
}
```

That would give a **Changes view** — olai's own commits, newest first, filtered by the `olai` prefix and the trailer so your own commits stay out of it — and **per-node history** on a node's zoomed page, needing no extra bookkeeping: the id is a string in the file, so `git log -S'"id":"<id>"' -- <file>` finds every commit that touched it.

**Neither shipped.** `changesOf` takes two readings and knows nothing about where they came from, which is the whole of what those two views need from this work; what is left is a `git log` reader, a route, a page and a sidebar decision, and none of that is the button. See the open questions.

## Messages

Prefixed with `olai`, always. In a project repository that prefix is what separates tool writes from yours: `git log --grep '^olai'` is the audit view, `--invert-grep` gives back your real history.

Composed, when nobody supplies one — subject names the biggest change by the fixed order `Sort` declares (created, archived, gone, done/undone, doing, moved, scheduled, noted, renamed, linked, edited), detail in the body, capped at twenty lines:

```
olai: 11 edits to roadmap — Outlines as a collection done

done: Outlines as a collection
date: Outlines as a collection -> 2026-08-10T18:07:08-04:00
note: WS frame cap undercuts the framework's
…
```

`set_date` used to print as `move:`. Beside real reparenting ops that read as a structural change that never happened; it says `date:` now, in both the composed body and the per-op summary an `auto` commit uses.

The subject names the node's TITLE, and this proposal's own example named its id. Both read the same on a roadmap, where every id is a slug somebody chose (`outlines-collection`) — but `add_node` MINTS an id when the caller does not supply one, which is the ordinary case for an agent capturing nodes, and the same subject then reads `olai: 2 edits to house — 1vax4izq created`. A permanent log line nobody can read is what this whole convention exists to prevent, so the title wins; a mirror, which has no title of its own, still answers with its id.

## The flag

`--commit=off | manual | auto`, default `manual`. `--no-commit` keeps meaning `off`, and wins when both are given.

`auto` is the old behaviour — one commit per op, the same per-op summary, now prefixed and signed — plus the one thing it was missing: it checks the repository state first and declines, out loud, into a merge or a rebase.

The mode is one module's business. `pending.ts` owns all three arms — `off` has nothing to say, `manual` answers only when asked, `auto` also takes a per-write door — so the write loop calls the same verb whichever mode it is in, and a change to how olai commits cannot ripple into two places.

> **Superseded, 2026-08-22 (`git-policy-server-side`).** `auto`'s per-write door is RETIRED. One commit per op turned a train of thought into a dozen commits — the thing `manual` was introduced to end — and the browser had grown a quiet window of its own to avoid exactly that, so olai shipped two features called Auto-commit that meant different things. `auto` is now that window, on the SERVER: everything waiting records itself once writes stop arriving for fifteen seconds, whoever wrote them. The rule is `@olai/format`'s `window.ts` and the timer over it is `@olai/ops`' `pending.ts`; the mode is still one module's business and `pending.ts` still owns all three arms. What is left of the per-write door is the SENTENCE a write carries back saying why it is not in the history yet. `--push=auto` moved with it and follows every settled commit, whichever door made it. See [git.md](../git.md#committing-on-its-own) and [running.md](../running.md#the-git-policy) for the shipped shape.

## Open questions

1. Nothing stops pending changes piling up over days, mixing several sessions of agent edits into one commit. The count in the chrome is a nag, not a plan. **Still open**: nothing shipped addresses it, and nothing shipped forecloses anything — a nudge, an age in the panel, or a session boundary are all still available.
2. Should the agent's `commit` tool be able to commit your pending edits along with its own? **Decided: yes, all of them.** Only-its-own would have to stage by writer, and the writer record is explicitly allowed to be empty — so after a restart that commit would silently commit nothing, which is the worst failure available to an audit trail. The scope was narrowed by FILE KIND instead — outlines only, never the documents or the other work in the tree. **`commit-whole-repo` removed that narrowing** and replaced it with a selection: everything dirty is offered, everything is ticked by default, and what a commit names is what somebody left ticked. The property the narrowing was protecting — a half-finished edit staged by hand is never swept up — holds because olai names its paths and never touches the index.
3. Does the Changes view belong in the sidebar beside outlines, calendar and docs, or is it only ever reached from the chrome pill? **Still open, and now unblocking rather than blocking**: the view is not built, and the derivation it needs is in hand and takes its two sides from anywhere.
