# Git integration

Git is how you see what olai did to your files — an audit trail, not sync and not undo. Writes land on disk and WAIT to be committed: from the pill in the app header (or, on a phone, from a banner when there is something to record), or by the agent's own `commit` tool, which is the better one to use — it knows where a train of thought ended, so its message can say `olai: reconcile the roadmap with the #70–#81 merges` instead of describing edits. The server can also press that button for you when the writes stop arriving — [Auto-commit](#committing-on-its-own), below.

**The one place that "not undo" is load-bearing is the emptied Trash** ([editing.md](editing.md)). Emptying it is a write like any other — the archive is rewritten holding no records, and the change waits here with everything else — so the history holds those rows to exactly the extent it had already recorded them, and no further. A directory that is not a repository, or one served `--no-commit`, holds none of them. A directory whose archive had been committed holds all of them, and `git show HEAD:_olai/Trash.olai` is how you read them back. Olai will not do that for you: nothing in the app reads a commit onto disk.

## The pill

The desktop pill is always there, because *there is no audit trail here* is the most important thing it can say and a control that vanished is how you would never find that out. On a phone a healthy tree is silent and uncommitted work is a banner under the header. It reads:

- `✓ committed · 12m ago` when everything is recorded;
- `no commits yet` when olai has never committed in this directory — a different fact, and not one an empty list can express;
- `4 uncommitted` when something is waiting;
- `no git here` / `commits off` when there is nothing to record at all. Those two are settings rather than problems, so they are dim and inert.

It carries one more thing beside that count: `· 2 unpushed`, when this repository holds commits the branch's upstream does not. "Not recorded" and "not shared" are two different facts about the same work, and an audit trail that lives on one machine is one disk failure from not existing. A successful auto-push takes that count to none.

**A push git REFUSED says so, and takes the tick with it.** `✓ committed · 13 unpushed` with the reason nowhere was a real screenshot, an hour into a push that had been failing every time: the refusal lived in one browser tab's memory, and that tab had been reloaded. It is a fact about the directory now, remembered by the server and published to every reader — so the pill wears `⚠` instead of `✓`, says `· 13 unpushed · the last push was refused`, and hands over git's own words on its tip, on its `aria-label` and in the panel. It clears itself the moment there is nothing unshared, including when you resolved it in a terminal.

Opening it shows what is waiting the way olai would say it rather than as a diff. Nothing about your working tree is stored to make any of it work: it is `git status`, one `git log` and what a commit already holds, read against what is on disk — so an outline you edited in vim is in the list too, and committing in a terminal takes it out. The one thing olai does keep is the copy each commit holds of the files you are editing: a commit cannot change, so that is read once and not once per keystroke, and typing no longer gets slower the longer you defer a commit.

If the repository is mid-merge, mid-rebase or on a detached HEAD, the commit button says so and does nothing — an agent that committed into a conflict could swallow the resolution.

A git failure never fails a write — the bytes are on disk and you have already seen them — but it is never silent either: the pill says `Git error` and hands you git's own words, and a write that did not reach the history comes back saying why, where the agent and the panel both read it.

## What is waiting: the whole repository

Everything git thinks has moved is in the panel, not only the outlines olai writes. Edit a `README.md` by hand and it is waiting; so is a source file, a document, an untracked file `.gitignore` does not cover, and an outline that lives outside the directory olai is serving. The panel says which part of the repository that is (`whole repository · olai serves docs/`), because a file two directories above your outlines is otherwise a surprise.

The two kinds of row are the two things olai can honestly say about a file:

```
┌─ Changes ─────────────────────────────────┐
│ olai: Outlines as a collection done       │
│   · chat agent · 12m ago · 1a2b3c4        │
│                                           │
│ OUTLINES ─────────────────────────────    │
│ ☑ roadmap.olai                            │
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

An outline olai serves gets its NODES and what changed about each — never a text diff, because a `.olai` diff is one enormous line per node with everything on it changing at once. Every other file gets its path and what git says happened to it: `modified`, `added`, `deleted`, `renamed`, `untracked`. Those are git's words rather than yours, so a `mv` you have not staged is a `deleted` and an `untracked` — `renamed` appears once both halves are staged.

A `renamed` row names BOTH halves (`old/name.md → name.olai`) and is one row with one tick: a rename is one thing that happened, and committing the arriving side on its own would land it in two pieces — an add here, a deletion still staged and waiting to be swept into whatever you commit next. That goes for an outline too: rename one and its nodes read as having MOVED, because the committed side olai compares against is HEAD's copy of the file it came from.

## Committing some of it

Every row has a tick and they all start ticked, so the ordinary sweep is still one click. Untick a file and it stays waiting, for a commit and a message of its own; the suggested message and the button rewrite themselves as you go, so what you are about to record is what the panel says you are.

**A selection is never git's index.** olai commits exactly the paths you ticked, naming each one, so anything you staged by hand is exactly as you left it afterwards — and a commit git REFUSES (a signature it cannot make, a hook, an identity nobody set) puts the index back bit-identical rather than leaving its own staging behind for your next commit to sweep up. Nothing here ever runs a bare `git add`, and nothing is staged for a path that has already left the working tree — that is what a `git mv` you staged yourself looks like, and it is recorded rather than refused.

The agent has the same thing: its `commit` tool takes an optional `paths`, the repository-root-relative names the pending list publishes. A path nothing is waiting on is refused by name rather than quietly skipped.

## Committing on its own

*prefs → Git commit*, Auto-commit, off by default. On, what is waiting records itself when writes stop arriving for **fifteen seconds** — so a burst of typing, or a train of agent ops, is ONE commit rather than one per write. It presses the same verb the Commit button does, with the same message the panel would have suggested and the same full sweep of the repository; there is no second committer and no second kind of commit in the log.

The span is the point rather than a setting. It has to outlast the pauses inside one piece of work — reading a line back, moving between rows, waiting on an agent's next op — or the promise breaks and one thought arrives as three commits; and it has to be short enough that what lands is still something you remember doing.

**Everything waiting counts, whoever wrote it.** The window watches what is PENDING, which is derived from git for the whole repository, so an agent writing over MCP restarts it, a `.md` you edited in vim joins the same commit, and what goes in is the same sweep the button makes. That is the whole of "all my changes end up in git".

**It is the INSTANCE's, not this browser's.** The row on the preferences panel is the only one there that is not a claim about you: it draws the policy this *server* runs under for this directory, always read-only, and every tab drawing the panel draws the same answer. There is no runtime door. `olai web --commit=auto` is that same row given on the command line ([running.md](running.md#the-git-policy)).

It used to be this browser's, and everything wrong with that followed from the frame. A directory recorded only while somebody had a tab open; two browsers could each have the toggle on and race one work tree (one browser's tabs contended for a Web Lock, which said nothing about the other's); and `--commit=auto` was a *different* feature with the same name — one commit per write, made inside the write gate, never pushed. There is one window now, on the server, and one of it per served directory: one olai holds a directory, so there is nothing to elect.

With Auto-push on beside it, the flurry is committed and then pushed and there is nothing left to press. With Auto-commit alone, the commits accumulate and the pill's `· N unpushed` says how many.

### When it stops

A commit or a push that git REFUSED **pauses the loop**, and the pill says so — `· auto-commit paused`, with git's own words on the tip, on its `aria-label`, and in full in the panel. On a phone the banner says it too, and keeps the count beside it (`3 uncommitted · auto-commit paused`), because a halted loop and a later edit is exactly when how much is sitting here is worth knowing. Nothing goes round again: the window is not re-armed, and a second flurry sits waiting where you can see it.

The case that matters is a DIVERGENCE. Another machine of yours — or somebody else — has pushed, so your push is a non-fast-forward. olai does not pull, does not rebase and never forces (that is [Pushing](#pushing)'s rule and this does not get an exception), so the commit stands, the push does not happen, and you are told. Resolving it is a conversation in a terminal, which is what git's words are for.

**The stop belongs to the directory, and `Resume` is the one way out of it.** The button is under the Git commit row and is drawn only while the loop is actually stopped. Nothing clears the pause on olai's own initiative, because a loop that un-paused itself is the blind retry wearing a different hat — and nothing else clears it either: a reload does not, a second tab does not, and turning the row off and on again does not. Press Resume in any tab and every reader's pill goes back to `armed` at once.

**Restarting the server does clear it, and that is the one deliberate exception.** Nothing about a refusal is written down, so a fresh process starts with no stop and no words. A restart is something an operator did, which a reload was not. What that would cost on its own is the count going quiet again: `olai.service` restarts on its own, and a branch that has been refusing for hours would come back up reading `✓ committed · 13 unpushed` with the reason nowhere. So the words are **re-earned rather than remembered** — where Auto-push is on and the branch has commits an upstream does not, a boot makes one push, the same bare one every other door makes, and whatever git says is on the chip before anybody looks. Where Auto-push is off, or the branch has nothing to send, or it has no upstream at all, a boot attempts nothing: a branch nobody has ever pushed is not a branch that is behind, and a startup that said so would stop the loop of every such directory over something that is not wrong.

That is a change worth saying out loud, because the old behaviour looked like a fix. The pause used to live in the tab that made the attempt: reloading the page started the loop again with nobody pressing anything, a second tab knew nothing about the stop, and on a headless serve there was no loop to stop at all. A retry dressed as a fresh start is the thing this design refuses.

A repository that cannot take a commit *at all* — mid-merge, mid-rebase, a detached HEAD — is the other thing and is a **pause rather than a stop**: nothing is attempted while it lasts, the pill says which state it is in exactly as it always has, and what is waiting is recorded once you have finished. There is nothing to Resume for that one. Never attempting is also the point: an automatic commit landing in the middle of a conflict is how a resolution gets swallowed.

## Pushing

One verb, and it is the only reason left to open a terminal for this: the current branch, to the upstream it already tracks. No remote to pick, no refspec, never a force. The panel offers it when there is something to send (`2 commits not on origin/master · Push`), and the same count is on the pill.

The server can follow a commit with that same verb: *prefs → Git push*, Auto-push, off by default. It follows **every** commit olai makes in this directory, whichever door made it — the Commit button, an agent's `commit` tool, and the quiet window's own — because those are one verb and the policy is one fact about the directory. One network round trip per commit, which is affordable exactly because the window makes a burst of writes one commit.

That is the second half of the row moving to the server, and it closes a real hole: Auto-push used to fire inside one tab's own commit callback, so a commit an agent made was never pushed, a commit a headless `--commit=auto` made was never pushed, and the unpushed count grew with nothing anywhere saying why.

A commit whose push fails is still a commit: git's words are remembered and drawn on the pill and in the panel, nothing is rolled back, and nothing is retried — the loop stops instead ([When it stops](#when-it-stops)).

There is no pull, no fetch and no branch UI, and that is deliberate — this is an audit-trail recorder rather than a git client. When git refuses — a non-fast-forward, an authentication failure, a branch with no upstream — you get git's own words, verbatim, because resolving it is a conversation in a terminal and those words are how it starts. A repository that is mid-rebase says so instead, naming the rebase.

The agent has this one too, as a `push` tool that takes nothing at all.

## Modes

- `--commit=manual`, the default: writes wait, and committing is deliberate, as above.
- `--commit=auto` IS [Auto-commit](#committing-on-its-own) — the same quiet window, given on the command line. What is waiting records itself once writes stop arriving for fifteen seconds, and it sweeps the whole repository.
  It used to be a second, differently-shaped feature with the same name: one commit per write, made inside the write gate, never pushed. **That is retired.** A train of thought arrived as a dozen commits, which is the thing manual mode was introduced to end, and there is no per-write commit left in olai.
- `--commit=off` (or `--no-commit`) is for a directory whose history is somebody else's job. The pill says which of those two it is rather than vanishing, and nothing is ever `git init`ed on your behalf.

Giving `--commit` at all — or `--push`, its neighbour — **sets** the matching row in every browser's preferences: read-only, in the state that flag comes to, with the flag itself on screen. `--commit=auto` shows it on, and both `manual` and `off` show it Off — `manual` because a write waiting for the Commit button is exactly what Off means, and `off` because a directory olai never commits in has no window to run. The line under the row names the flag either way, so the two Offs are told apart by what set them. Omitting the flag uses the built-in default; the row is still read-only. That is the instance's answer for a directory more than one person is looking at, and it is [running.md](running.md#the-git-policy)'s subject.

## The audit view

Every commit message starts with `olai`, so `git log --grep '^olai'` is the audit view and `--invert-grep` gives you back your own history. Each commit carries an `X-Olai-Writer` trailer saying which of you — the chat agent, an MCP client, the browser (`web`: the keyboard editor and the row's `•••` menu, which write through the same door), or `auto` for one the quiet window made with nobody pressing anything — wrote it. A line typed in a terminal has no word of its own: `olai surface` speaks to the same `/mcp` an agent does, so its writes wear that door's trailer — which this serve composes as `chat-agent`. So the trailer separates the browser from everything on `/mcp`, and does not separate a person at a terminal from an agent. A commit that swept up files beside the outlines names them in its body, with what happened to each, so the log says what the commit did rather than only what it was about.

Signing is not skipped. A hook is your project's rule about the commits people type, so olai passes `--no-verify`; a signature is your statement about your own history, and an olai commit is a commit in it — where you have a key it is signed like every other one, and where you do not, the refusal comes back with gpg's own words rather than an unsigned commit you did not ask for.
