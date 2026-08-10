# Committing changes

Status: PROPOSAL, 2026-08-10.

Today every op commits itself (`packages/ops/src/git.ts`). This replaces that
with a commit someone asks for — a button in the UI, or a tool the agent calls.

## Why olai touches git at all

There are two writers today: the **chat agent** and **MCP**. There is no web
editor yet — `self-edit` has not shipped, and `ops.ts` says as much in passing
("the web UI's own ops procedures, *when they arrive*").

So every write olai makes is a write you did not type, and chat auto-approves its
ops. Git is how you see what the tool did to your files. That is the one job:
**an audit trail of what olai wrote.**

It is not for history (the descs carry their own dates), not for sync (olai never
pushes), and not for undo (the `undo` item plans real op inverses).

## How it works

Writes land on disk immediately, through the store's existing gate. They wait to
be committed. Two doors to the same action:

- **A Commit button**, for you.
- **A `commit` MCP tool**, for the agent — it knows where its work ends and why,
  so its message can say `olai: reconcile roadmap with the #70–#81 merges`.

An automatic mode stays available for someone running olai headless with no
browser to press anything, but it is off unless asked for.

Nothing is ever `--amend`ed. Amending rewrites history, which is a trap once a
commit has been pushed.

## The button

Lives in the bottom-right chrome strip that `panels` is building, beside the
connection dot and the agent pill. Nothing pending, nothing shown.

```
                                    ┌──────────────────────────┐
                                    │  4 uncommitted        ▲  │
                                    └──────────────────────────┘
```

Opened:

```
┌─ Changes ─────────────────────────────────┐
│ roadmap.jsonl                             │
│   ✓  Outlines as a collection    done     │
│   ✎  Notes: one state, same line  note    │
│   +  Kolu integration: auto-…    created  │
│   ⌦  Outlines as a collection    archived │
│                                           │
│ chat-agent 3 · you 1                      │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ olai: reconcile roadmap with the      │ │
│ │ #70–#81 merges                        │ │
│ └───────────────────────────────────────┘ │
│                      [ Commit 4 changes ] │
└───────────────────────────────────────────┘
```

When the repository is mid-rebase, mid-merge, or on a detached HEAD, the button
says so instead of quietly doing nothing:

```
│  ⚠ rebase in progress — finish it first   │
│                      [ Commit 4 changes ] │   ← disabled
```

Not a work tree: no indicator, no panel.

## The data model

**One rule: derive it from git, store nothing.** Same discipline as node status
and blockedness. Anything we cached would be a second answer to a question git
already answers, and it would be wrong the moment you edit a file in vim.

### What changed, in olai's words

Never show a text diff. A `.jsonl` diff is one enormous line per node with
everything on it changing at once. The unit is a node:

```ts
type NodeChange = {
  readonly file: string      // root-relative
  readonly id: string
  readonly title: string     // as it reads now; as it read at HEAD when removed
  readonly kind: "added" | "removed" | "changed"
  readonly fields: ReadonlyArray<Field>   // empty unless kind is "changed"
}

type Field = "title" | "desc" | "done" | "doing" | "date"
           | "see" | "after" | "parent" | "ord"
```

The wording is a render-time function of `fields`, so the model stays small:
`["done"]` reads as *marked done*, `["parent", "ord"]` as *moved*, `["desc"]` as
*note rewritten*.

### Is the repository free?

```ts
type RepoState =
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Ready";   readonly branch: string }
  | { readonly _tag: "Blocked"; readonly reason: Reason; readonly said: string }

type Reason = "merge" | "rebase" | "cherry-pick" | "detached"
```

This is what drives the disabled button and its explanation. It is also the check
`git.ts` is missing today — it asks only whether the directory is a work tree.

### What is pending

```ts
type Pending = {
  readonly repo: RepoState
  readonly changes: ReadonlyArray<NodeChange>
  readonly unreadable: ReadonlyArray<string>   // dirty files we cannot parse
  readonly wrote: ReadonlyArray<{ readonly writer: Writer; readonly ops: number }>
  readonly message: string                     // composed suggestion
}

type Writer = "chat-agent" | "mcp" | "web"
```

`changes` comes from git: ask `git status --porcelain` which served files are
dirty, read each one's committed version with `git show HEAD:<file>`, parse both
sides with the codec we already have, compare. A file that no longer parses is
listed in `unreadable` rather than dropped.

Cost is bounded by what is dirty. A clean directory is one `git status` and no
parsing at all.

### Who wrote it — intent, not truth

`wrote` cannot come from git; git only knows the bytes moved. It comes from a
small in-memory list the ops layer appends to and clears on a successful commit:

```ts
type Written = {
  readonly writer: Writer
  readonly summary: string          // the per-op line ops already builds
  readonly ids: ReadonlyArray<string>
  readonly at: string
}
```

This is a **decoration on the git-derived truth, never a replacement**. It is
empty after a restart, and it knows nothing about edits made outside olai. Both
are fine: the panel then shows the changes with no writer beside them. Nothing
downstream may assume it is complete.

The commit itself records the writer permanently, as a trailer:

```
X-Olai-Writer: chat-agent
```

Commits otherwise take the repository's own name and email, so without this an
agent's edits are indistinguishable from yours — which would defeat the point.

### Asking for a commit

```ts
type CommitRequest = { readonly message?: string }   // omitted → composed

type CommitResult =
  | { readonly _tag: "Committed"; readonly sha: string; readonly changes: number }
  | { readonly _tag: "NothingToCommit" }
  | { readonly _tag: "Blocked";   readonly repo: RepoState }
  | { readonly _tag: "Failed";    readonly said: string }
```

Both doors — the button's procedure and the MCP tool — call the same thing, added
beside `run` and `read` on `Ops`:

```ts
readonly pending: Effect.Effect<Pending, OpFailure>
readonly commit: (request: CommitRequest) => Effect.Effect<CommitResult, OpFailure>
```

Only the files olai wrote are staged, named explicitly on both `add` and
`commit`, exactly as today — a served directory is a working tree with other work
in it.

### Where it is computed

`pending` is a surface cell, recomputed on the probe tick the store already runs,
and again right after a commit. The repository's state is re-read at the same
time, since nothing watches `.git`.

The git plumbing (`status`, `show`, `state`) belongs in `ops/git.ts`. Comparing
two parsed sets is pure and belongs beside the format, with no git in it.

### The same function serves history

A history entry is the same derivation with different inputs: **pending is HEAD
against the working tree; a past change is a commit against its parent.** One
comparison function, two callers.

```ts
type Change = {
  readonly sha: string
  readonly message: string
  readonly writer: Writer | null    // from the trailer
  readonly at: string
  readonly changes: ReadonlyArray<NodeChange>
}
```

That gives a **Changes view** — olai's own commits, newest first, filtered by the
`olai` prefix and the trailer so your own commits stay out of it.

And **per-node history** on a node's zoomed page, needing no extra bookkeeping:
the id is a string in the file, so `git log -S'"id":"<id>"' -- <file>` finds every
commit that touched it.

## Messages

Prefixed with `olai`, always. In a project repository that prefix is what
separates tool writes from yours: `git log --grep '^olai'` is the audit view,
`--invert-grep` gives back your real history.

Composed, when nobody supplies one — subject names the biggest change by a fixed
order (created, archived, done/doing, moved, note, title), detail in the body:

```
olai: 11 edits to roadmap — outlines-collection done

done: Outlines as a collection
move: Outlines as a collection -> 2026-08-10T18:07:08-04:00
note: WS frame cap undercuts the framework's
…
```

`set_date` currently prints as `move:`. Beside real reparenting ops that reads as
a structural change that never happened; it should say what it is.

## The flag

`--commit=off | manual | auto`, default `manual`. `--no-commit` keeps meaning
`off`.

## Open questions

1. Nothing stops pending changes piling up over days, mixing several sessions of
   agent edits into one commit. The count in the chrome is a nag, not a plan.
2. Should the agent's `commit` tool be able to commit your pending edits along
   with its own? Only-its-own is cleaner but means tracking the batch per writer,
   and `Written` is explicitly allowed to be incomplete.
3. Does the Changes view belong in the sidebar beside outlines, calendar and
   docs, or is it only ever reached from the chrome pill?
