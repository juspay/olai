# Git integration

Git is how you see what olai did to your files — an audit trail, not sync and
not undo. Writes land on disk and WAIT to be committed: from the pill in the
app header, or by the agent's own `commit` tool, which is the better one to
use — it knows where a train of thought ended, so its message can say
`olai: reconcile the roadmap with the #70–#81 merges` instead of describing
edits.

## The pill

The pill is always there, because *there is no audit trail here* is the most
important thing it can say and a control that vanished is how you would never
find that out. It reads:

- `✓ committed · 12m ago` when everything is recorded;
- `no commits yet` when olai has never committed in this directory — a
  different fact, and not one an empty list can express;
- `4 uncommitted` when something is waiting;
- `no git here` / `commits off` when there is nothing to record at all. Those
  two are settings rather than problems, so they are dim and inert.

It carries one more thing beside that count: `· 2 unpushed`, when this
repository holds commits the branch's upstream does not. "Not recorded" and
"not shared" are two different facts about the same work, and an audit trail
that lives on one machine is one disk failure from not existing.

Opening it shows what is waiting the way olai would say it rather than as a
diff. Nothing is stored to make any of it work: it is `git status`,
`git show HEAD:` and one `git log` against what is on disk, so an outline you
edited in vim is in the list too, and committing in a terminal takes it out.

If the repository is mid-merge, mid-rebase or on a detached HEAD, the commit
button says so and does nothing — an agent that committed into a conflict
could swallow the resolution.

A git failure never fails a write — the bytes are on disk and you have
already seen them — but it is never silent either: the pill says `Git error`
and hands you git's own words, and a write that did not reach the history
comes back saying why, where the agent and the panel both read it.

## What is waiting: the whole repository

Everything git thinks has moved is in the panel, not only the outlines olai
writes. Edit a `README.md` by hand and it is waiting; so is a source file, a
document, an untracked file `.gitignore` does not cover, and an outline that
lives outside the directory olai is serving. The panel says which part of the
repository that is (`whole repository · olai serves docs/`), because a file two
directories above your outlines is otherwise a surprise.

The two kinds of row are the two things olai can honestly say about a file:

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
│                                           │
│ OTHER FILES ──────────────────────────    │
│ ☑ README.md                    modified   │
│ ☐ notes/scratch.md            untracked   │
│                                           │
│ whole repository · olai serves docs/      │
│ chat agent 3 · you 1                      │
│                                           │
│ 2 commits not on origin/master   [ Push ] │
│         [ Commit 3 changes · 1 file ]     │
└───────────────────────────────────────────┘
```

An outline olai serves gets its NODES and what changed about each — never a
text diff, because a `.jsonl` diff is one enormous line per node with
everything on it changing at once. Every other file gets its path and what git
says happened to it: `modified`, `added`, `deleted`, `renamed`, `untracked`.
Those are git's words rather than yours, so a `mv` you have not staged is a
`deleted` and an `untracked` — `renamed` appears once both halves are staged.

## Committing some of it

Every row has a tick and they all start ticked, so the ordinary sweep is still
one click. Untick a file and it stays waiting, for a commit and a message of
its own; the suggested message and the button rewrite themselves as you go, so
what you are about to record is what the panel says you are.

**A selection is never git's index.** olai commits exactly the paths you
ticked, naming each one, so anything you staged by hand is exactly as you left
it afterwards — and a commit git REFUSES (a signature it cannot make, a hook,
an identity nobody set) puts the index back bit-identical rather than leaving
its own staging behind for your next commit to sweep up. Nothing here ever runs
a bare `git add`.

The agent has the same thing: its `commit` tool takes an optional `paths`, the
repository-root-relative names the pending list publishes. A path nothing is
waiting on is refused by name rather than quietly skipped.

## Pushing

One verb, and it is the only reason left to open a terminal for this: the
current branch, to the upstream it already tracks. No remote to pick, no
refspec, never a force. The panel offers it when there is something to send
(`2 commits not on origin/master · Push`), and the same count is on the pill.

There is no pull, no fetch and no branch UI, and that is deliberate — this is an
audit-trail recorder rather than a git client. When git refuses — a
non-fast-forward, an authentication failure, a branch with no upstream — you get
git's own words, verbatim, because resolving it is a conversation in a terminal
and those words are how it starts. A repository that is mid-rebase says so
instead, naming the rebase.

The agent has this one too, as a `push` tool that takes nothing at all.

## Modes

- The default: writes wait, and committing is deliberate, as above.
- `--commit=auto` is one commit per write, for a server with no browser in
  front of it. It commits exactly the files that write produced — never the
  rest of the repository.
- `--commit=off` (or `--no-commit`) is for a directory whose history is
  somebody else's job. The pill says which of those two it is rather than
  vanishing, and nothing is ever `git init`ed on your behalf.

## The audit view

Every commit message starts with `olai`, so `git log --grep '^olai'` is the
audit view and `--invert-grep` gives you back your own history. Each commit
carries an `X-Olai-Writer` trailer saying which of you — the chat agent, an
MCP client, or the keyboard — wrote it. A commit that swept up files beside the
outlines names them in its body, with what happened to each, so the log says
what the commit did rather than only what it was about.

Signing is not skipped. A hook is your project's rule about the commits people
type, so olai passes `--no-verify`; a signature is your statement about your own
history, and an olai commit is a commit in it — where you have a key it is
signed like every other one, and where you do not, the refusal comes back with
gpg's own words rather than an unsigned commit you did not ask for.
