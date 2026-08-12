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

## Modes

- The default: writes wait, and committing is deliberate, as above.
- `--commit=auto` is one commit per write, for a server with no browser in
  front of it.
- `--commit=off` (or `--no-commit`) is for a directory whose history is
  somebody else's job. The pill says which of those two it is rather than
  vanishing, and nothing is ever `git init`ed on your behalf.

## The audit view

Every commit message starts with `olai`, so `git log --grep '^olai'` is the
audit view and `--invert-grep` gives you back your own history. Each commit
carries an `X-Olai-Writer` trailer saying which of you — the chat agent, an
MCP client, or the browser (`web`: the keyboard editor and the row's `•••`
menu, which write through the same door) — wrote it.
