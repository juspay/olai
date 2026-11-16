# Git

olai records what it writes to your files as git commits: an audit trail, not sync and not undo.[^plugin] Writes land on disk at once and wait to be committed.[^doors]

## Read what is waiting

The Commit readout says what is waiting: `Committed · 12m ago`, `3 uncommitted`, `Git error`.[^words] On a desktop it is a row of the popover the health dot opens; on a phone it is a banner under the header.[^dot] A git failure never fails a write.[^failure][^merge]

## Commit some of it

The readout lists what is waiting the way olai would say it, not as a diff.[^lists][^nodes][^stored]

1. Every row starts ticked, so the ordinary sweep is one press.
2. Untick a file to leave it waiting for a commit and a message of its own.[^suggested]
3. Type your own message if the suggested one cannot say why you made the change.[^prepared]
4. Press **Commit**, which names what it will record: `Commit 3 changes · 1 file`.[^exact][^agent]

## Let the server commit

Set `commit` and `push` on the `git` node in `_olai/Settings.olai` ([settings.md](settings.md)).[^panel][^live] A commit or a push git refused pauses the loop.[^paused]

| Written | What happens |
| --- | --- |
| `commit: manual` | the default: writes wait, and committing is deliberate |
| `commit: auto` | what is waiting records itself fifteen seconds after writes stop[^window][^everything] |
| `commit: off` | nothing is recorded, and the readout says so rather than vanishing |
| `push: off` | the default: what is committed stays here until you press **Push** |
| `push: auto` | every commit olai makes is pushed[^pushauto] |

## Push

One verb, the current branch to the upstream it already tracks.[^verb] The panel offers **Push** beside `2 commits not on origin/master`, and the same count rides the readout.[^rebase][^refuses][^client]

## The audit view

Every commit message starts with `olai`, so `git log --grep '^olai'` is the audit view and `--invert-grep` gives you back your own history.[^body] Each commit carries an `X-Olai-Writer` trailer.[^trailer][^hook][^undo]

[^plugin]: Git is one of the plugins and is on by default. A serve that does not run it has no Commit readout and records nothing ([plugins/git.md](plugins/git.md)).

[^doors]: What is waiting is committed from the commit panel, from an agent's `git_commit` tool, or from the server when writes stop arriving.

[^words]: Every word the readout says, and what each means, is in the closed block at the foot of this page, along with what rides on it: unpushed commits, a refused push and a paused loop.

[^dot]: The Commit readout is always there on a desktop, in the popover the header's health dot opens. Its own dot folds into that health dot: writes waiting, unpushed commits and a busy repository turn it amber; a git error, a refused push and a paused loop turn it red. On a phone a healthy tree is silent, and uncommitted work is the banner.

[^failure]: A git failure never fails a write: the bytes are on disk, and the write comes back saying why it did not reach the history. A refusal is remembered by the server and published to every reader, so a reload does not lose the reason. It clears the moment there is nothing unshared, including when you resolved it in a terminal.

[^merge]: A repository mid-merge, mid-rebase, mid-cherry-pick or on a detached `HEAD` says so and refuses to commit: **A merge is in progress. Finish it first**, and the three like it.

[^lists]: The pending list holds everything git thinks has moved, not only the outlines olai writes: a `README.md` you edited by hand, a source file, an untracked file `.gitignore` does not cover, an outline outside the directory olai serves. The scope line says which part of the repository this is: `Whole repository · olai shows docs/`.

[^nodes]: An outline olai serves gets its nodes and what changed about each, never a text diff. Every other file gets its path and git's own word for what happened: `modified`, `added`, `deleted`, `renamed`, `untracked`.

    A `mv` you have not staged is a `deleted` and an `untracked`; `renamed` appears once both halves are staged. A `renamed` row names both halves (`old/name.md → name.olai`) and is one row with one tick, because a rename is one thing that happened. Rename an outline and its nodes read as having moved.

[^stored]: Nothing about your working tree is stored. This is `git status`, one `git log` and what a commit already holds, read against disk — so an outline you edited in vim is in the list, and committing in a terminal takes it out.

[^suggested]: The suggested message and the button rewrite themselves as you untick.

[^prepared]: Your typed message and the files you excluded stay prepared in this tab when you close the panel or the plugins rebuild it. A successful commit clears that preparation; a refused one keeps it.

[^exact]: olai commits exactly the paths you ticked, naming each one, so anything you staged by hand is left as you had it. A commit git refuses puts the index back bit-identical, and one stopped mid-flight either landed or left no staging behind.

[^agent]: An agent's `git_commit` is the better door for its own work, because it knows where a train of thought ended and its message can say so. It takes an optional `paths`, the repository-root-relative names the pending list publishes, and refuses a path nothing is waiting on by name.

[^panel]: The plugins panel draws `commit` and `push` in the Git row's detail: press the chevron beside **Git**. A ● marks a value that came from the file, ↺ removes it, and **Saved in** opens the node holding it.

[^live]: Changing either mode is live: the row keeps its open panel and its remembered pause, and the next decision reads the new value. `push` moved from `off` to `auto` sends the commits already recorded here, once. Nothing is ever `git init`ed on your behalf.

[^paused]: A paused loop is read on the readout as `Auto-commit paused`, with git's own words on the tip and in full in the panel. What stops it, and how to start it again, is in the closed block at the foot of this page, with what a lock file in the way does.

[^window]: The quiet window makes a burst of typing or a train of agent work one commit. It presses the same verb the button does, with the same suggested message and the same sweep of the repository.

[^everything]: Everything waiting counts, whoever wrote it: an agent writing over MCP restarts the window, and a `.md` you edited in vim joins the same commit. The panel says **Auto-commit will commit all of this once you stop editing** while the window really is about to do it.

[^pushauto]: With `push: auto` the flurry is committed, taken in and pushed, and there is nothing left to press. With it off, the commits accumulate and the readout counts them as unpushed. It follows every commit olai makes here, whichever door made it: the button, `git_commit`, and the quiet window's own.

[^verb]: A push picks no remote and no refspec, and is never a force. The panel offers it when there is something to send.

[^rebase]: A push takes the upstream in first: it fetches, rebases what is unpushed onto the moved branch, and sends, so a push from here is never a non-fast-forward. The take-in runs in a linked worktree olai makes under the git directory, and your tree changes only as the whole move succeeds.

[^refuses]: When git refuses a push, you get git's own words, verbatim, because resolving it is a conversation in a terminal. What it refuses is a conflict, an authentication failure, an integration that could not run, or a branch with no upstream. A commit whose push fails is still a commit: nothing is rolled back and nothing is retried.

[^client]: An agent's `git_push` takes nothing at all. There is no pull and no branch control: this is an audit-trail recorder rather than a git client.

[^body]: A commit that swept up files beside the outlines names them in its body, with what happened to each.

[^trailer]: The `X-Olai-Writer` trailer names the door that wrote the commit: `chat-agent`, `mcp`, `web`, `filer`, `auto` or `sleep`. Each is in the table at the foot of this page, with what it stands for.

[^hook]: A hook is your project's rule about the commits people type, so olai passes `--no-verify`. A signature is your statement about your own history: where you have a key the commit is signed, and where you do not, the refusal comes back with gpg's own words.

[^undo]: The two places "not undo" matters are the emptied trash and a deleted file. History holds them exactly as far as it had already recorded them, and `git show HEAD:_olai/Trash.olai` reads a trashed row back. Nothing in olai reads a commit onto disk for you.

<details>
<summary>Every word the readout says</summary>

| It says | It means |
| --- | --- |
| `Committed · 12m ago` | everything is recorded |
| `No commits yet` | this is a repository, and olai has not committed here |
| `3 uncommitted` | that many writes are waiting |
| `Git error` | git failed here, so changes are saved and not committed |
| `Not a git folder` | the directory is not a repository |
| `Commits off` | the policy is `commit: off` |
| `· 2 unpushed` | this branch holds commits its upstream does not |
| `· Push refused` | git said no to the last push |
| `· Auto-commit paused` | the loop stopped; see [when the loop stops](#when-the-loop-stops) |

- `Not a git folder` and `Commits off` are settings rather than problems, so they are dim and inert, draw no dot, and leave the health dot green.
- The last three ride whichever words the readout is wearing, on the tip, on the `aria-label` and in the panel. The phone banner carries them too: `3 uncommitted · Auto-commit paused — tap to see`.

</details>

<details>
<summary>What the panel looks like</summary>

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
│ Whole repository · olai shows docs/       │
│ chat agent 3 · you 1                      │
│                                           │
│ 2 commits not on origin/master   [ Push ] │
│         [ Commit 3 changes · 1 file ]     │
└───────────────────────────────────────────┘
```

</details>

<details>
<summary>When the auto-commit loop stops, and a lock file in the way</summary>

### When the loop stops

Nothing goes round again after a refusal: the window is not re-armed, and a second flurry sits waiting where you can see it.

- What stops it is a conflict, a fetch or push the remote refused, or an integration that could not run. The panel names the files and quotes git. Resolve it in a terminal, with `git pull --rebase`, then press **Resume**.
- An uncommitted edit in a path the upstream changed is a wait rather than a stop: commit what is yours first, and the next push goes.
- **Resume** sits under the Git commit row and is drawn only while the loop is stopped. Nothing else clears a pause: not a reload, not a second tab, not switching the row off and on. Press it in any tab and every reader's readout is armed again.
- Restarting the server does clear it, because nothing about a refusal is written down. Where `push: auto` is on and the branch has commits to send, a boot makes one push, and whatever git says is on the readout before anybody looks.
- A repository that cannot take a commit at all is a pause rather than a stop. Nothing is attempted while it lasts, and what is waiting is recorded once you have finished; there is nothing to resume.

### A lock file in the way

git refuses every write while an `index.lock` exists, and a killed process, a full disk or a machine that went down mid-write leaves one behind. The panel says what is in the way and how long ago it was left, and offers **Remove lock file & retry**. Press it and the file goes, the refusal and the pause go with it, and the commit you were refused is made with the message and the ticks the panel is holding.

> olai removes the file only once it is more than ten seconds old. Inside that window the button answers *A git process may still be writing; try again in a moment.* Check that no git command is running before you press.

- Nothing is removed on olai's own initiative, and there is no verb for it on the agent face.
- The file removed is the one in the git directory of the repository olai serves. A linked worktree's lock lives under `.git/worktrees/<name>`.
- Where the file cannot be removed at all, the errno is drawn beside the button rather than a report that it was removed.
- A lock does not stop the survey: `git status` answers with one in place, so what is waiting is still listed. Only the write verbs refuse.

</details>

<details>
<summary>Who wrote a commit</summary>

| Trailer | Who |
| --- | --- |
| `chat-agent` | an agent in olai's own panel |
| `mcp` | anything on `/mcp`, including a line you typed with `olai surface` |
| `web` | the browser: the keyboard editor and the row's `•••` menu |
| `filer` | olai filing conversations into the Inbox |
| `auto` | the quiet window, with nobody pressing anything |
| `sleep` | a node agent's own pass over its memory ([node-agents.md](node-agents.md)) |

</details>
