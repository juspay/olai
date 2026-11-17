# Git: how olai records what it writes

olai records what it writes to your files as git commits: a history, not sync and not undo.[^plugin] Writes reach the disk at once and wait to be committed.[^doors]

## Read what is waiting

The Commit readout is the line in the header that says what is waiting: `Committed · 12m ago`, `3 uncommitted`, `Git error`.[^words][^dot] A git failure never fails a write.[^failure][^merge]

## Commit some of it

Open the readout and the commit panel lists what is waiting in olai's own words, rather than as a diff.[^lists][^nodes][^stored]

1. Open the readout. Every row starts ticked, so committing everything is one click.
2. Untick a file to leave it waiting for a commit and a message of its own.[^suggested]
3. Type your own message if the suggested one cannot say why you made the change.[^prepared]
4. Click **Commit**, which names what it will record: `Commit 3 changes · 1 file`.[^exact][^agent]

## Let the server commit

Set `commit` and `push` on the `git` row in `_olai/Settings.olai` ([settings.md](settings.md)).[^panel][^live] When git refuses a commit or a push, olai stops committing on its own until you start it again.[^paused]

| Written | What happens |
| --- | --- |
| `commit: manual` | the default: writes wait, and you commit when you mean to |
| `commit: auto` | everything waiting is committed fifteen seconds after writes stop[^window][^everything] |
| `commit: off` | nothing is committed, and the readout says so rather than disappearing |
| `push: off` | the default: commits stay here until you click **Push** |
| `push: auto` | every commit olai makes is pushed[^pushauto] |

## Push

One action: push the current branch to the branch it tracks.[^verb] The panel offers **Push** beside `2 commits not on origin/master`, and the readout carries the same count.[^rebase][^refuses][^client]

## Find olai's commits in your history

Every commit message olai writes starts with `olai`, so `git log --grep '^olai'` lists olai's commits, and `--invert-grep` lists yours.[^body] Each commit also carries an `X-Olai-Writer` trailer.[^trailer][^hook][^undo]

[^plugin]: Git is one of the plugins, and it is on by default. A server running without it has no Commit readout and records nothing ([plugins/git.md](plugins/git.md)).

[^doors]: What is waiting is committed in one of three ways: from the commit panel, from an agent's `git_commit` tool, or by the server itself once writes stop arriving.

[^words]: Every word the readout can say, and what each one means, is in the first closed block at the foot of this page, along with what rides on it: unpushed commits, a refused push, and committing stopped after a refusal.

[^dot]: On a desktop the Commit readout is always there, in the popover the health dot in the header opens. Its own dot folds into that health dot: writes waiting, unpushed commits and a busy repository turn it amber; a git error, a refused push and committing stopped turn it red. On a phone a healthy tree says nothing, and uncommitted work is the banner.

[^failure]: A git failure never fails a write: the bytes are on disk, and the write comes back saying why it did not reach the history. The server remembers a refusal and shows it to every reader, so a reload does not lose the reason. It clears as soon as there is nothing unshared, including when you sorted it out in a terminal.

[^merge]: A repository in the middle of a merge, a rebase or a cherry-pick, or on a detached `HEAD`, says so and refuses to commit: **A merge is in progress. Finish it first**, and the three like it.

[^lists]: The list of what is waiting holds everything git thinks has changed, not only the outlines olai writes. It holds a `README.md` you edited by hand, a source file, an untracked file `.gitignore` does not cover, and an outline outside the directory olai serves. One line says which part of the repository this is: `Whole repository · olai shows docs/`.

[^nodes]: For an outline olai serves you get its rows and what changed about each of them, never a text diff. Every other file gets its path and git's own word for what happened: `modified`, `added`, `deleted`, `renamed`, `untracked`.

    A `mv` you have not staged shows as a `deleted` and an `untracked`; `renamed` appears once both halves are staged. A `renamed` row names both halves (`old/name.md → name.olai`) and is one row with one tick, because a rename is one thing that happened. Rename an outline and its rows read as having moved.

[^stored]: olai stores nothing about your working tree. The panel is `git status`, one `git log` and what a commit already holds, read against the disk. So an outline you edited in vim is in the list, and committing in a terminal takes it out.

[^suggested]: The suggested message and the button's own words change as you tick and untick.

[^prepared]: The message you typed and the files you unticked stay ready in this tab when you close the panel, or when the plugins rebuild it. A commit that succeeds clears them; a commit git refused keeps them.

[^exact]: olai commits exactly the paths you ticked, naming each one, so anything you staged by hand is left as you had it. A commit git refuses puts the index back exactly as it was, and one stopped mid-flight either landed or left nothing staged.

[^agent]: An agent's `git_commit` is the better way for an agent's own work, because it knows where a train of thought ended and its message can say so. It takes an optional `paths`, the names relative to the repository root that the waiting list shows, and refuses a path nothing is waiting on, by name.

[^panel]: The **Plugins** panel draws `commit` and `push` in the Git row's detail: click the chevron beside **Git**. A ● marks a value that came from your settings file, ↺ removes it, and **Saved in** opens the row holding it.

[^live]: Changing either setting takes effect at once: the row keeps its open panel and remembers that committing was stopped, and the next decision reads the new value. Moving `push` from `off` to `auto` sends the commits already recorded here, once. olai never runs `git init` for you.

[^paused]: When committing has stopped after a refusal, the readout says `Auto-commit paused`, with git's own words on the tooltip and in full in the panel. What stops it, and how to start it again, is in a closed block at the foot of this page, along with what happens when a lock file is in the way.

[^window]: Waiting fifteen seconds for writes to stop makes a burst of typing, or a run of agent work, into one commit. It does the same thing the button does, with the same suggested message and the same sweep of the repository.

[^everything]: Everything waiting counts, whoever wrote it: an agent writing over MCP starts the fifteen seconds again, and a `.md` you edited in vim joins the same commit. The panel says **Auto-commit will commit all of this once you stop editing** while that is really about to happen.

[^pushauto]: With `push: auto`, a burst of writes is committed, the upstream is taken in, and the result is pushed, with nothing left for you to click. With it off, commits pile up and the readout counts them as unpushed. It follows every commit olai makes here, however it was made: the button, `git_commit`, and the fifteen-second wait.

[^verb]: A push picks no remote and no refspec, and is never a force push. The panel offers it when there is something to send.

[^rebase]: A push takes the upstream in first: it fetches, rebases your unpushed commits onto the branch as it now stands, and sends them, so a push from here is never a non-fast-forward. The fetch and rebase happen in a linked worktree olai makes under the git directory, and your own tree changes only once the whole move succeeds.

[^refuses]: When git refuses a push you get git's own words, exactly as git said them, because sorting it out is a conversation in a terminal. What it refuses is a conflict, a failure to authenticate, a rebase onto the upstream that could not run, or a branch with no upstream. A commit whose push fails is still a commit: nothing is rolled back and nothing is retried.

[^client]: An agent's `git_push` takes no arguments at all. There is no pull and no branch control: this records an audit trail rather than being a git client.

[^body]: A commit that swept up files beside the outlines names them in its body, with what happened to each.

[^trailer]: The `X-Olai-Writer` trailer names the part of olai that wrote the commit: `chat-agent`, `mcp`, `web`, `filer`, `auto` or `sleep`. Each one is in the table at the foot of this page, with what it stands for.

[^hook]: A hook is your project's rule about the commits people type, so olai passes `--no-verify`. A signature is your own statement about your own history: where you have a key the commit is signed, and where you do not, the refusal comes back with gpg's own words.

[^undo]: Two things show that this is not undo: emptying the trash, and deleting a file. History holds them exactly as far as it had already recorded them, and `git show HEAD:_olai/Trash.olai` reads a trashed row back. Nothing in olai puts a commit back onto disk for you.

<details>
<summary>Every word the readout says</summary>

| It says | It means |
| --- | --- |
| `Committed · 12m ago` | everything is recorded |
| `No commits yet` | this is a repository, and olai has not committed here |
| `3 uncommitted` | that many writes are waiting |
| `Git error` | git failed here, so changes are saved and not committed |
| `Not a git folder` | the directory is not a repository |
| `Commits off` | the setting is `commit: off` |
| `· 2 unpushed` | this branch holds commits its upstream does not |
| `· Push refused` | git said no to the last push |
| `· Auto-commit paused` | committing has stopped; see [when committing stops](#when-committing-stops) |

- `Not a git folder` and `Commits off` are settings rather than problems, so they are dim and do nothing, draw no dot, and leave the health dot green.
- The last three ride on whichever words the readout is wearing, on the tooltip, on the `aria-label` and in the panel. The phone banner carries them too: `3 uncommitted · Auto-commit paused — tap to see`.

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
<summary>When committing stops, and a lock file in the way</summary>

### When committing stops

After a refusal, nothing is tried again: the fifteen-second wait is not armed, and a second burst of writes sits waiting where you can see it.

- What stops it is a conflict, a fetch or push the remote refused, or a rebase onto the upstream that could not run. The panel names the files and quotes git. Sort it out in a terminal, with `git pull --rebase`, then click **Resume**.
- An uncommitted edit in a file the upstream also changed makes olai wait rather than stop: commit what is yours first, and the next push goes.
- **Resume** sits under the Git commit row and is drawn only while committing is stopped. Nothing else clears it: not a reload, not a second tab, not switching the plugin off and on. Click it in any tab and every reader's readout is armed again.
- Restarting the server does clear it, because nothing about a refusal is written down. Where `push: auto` is on and the branch has commits to send, starting up makes one push, and whatever git says is on the readout before anybody looks.
- A repository that cannot take a commit at all makes olai wait rather than stop. Nothing is attempted while that lasts, and what is waiting is committed once you have finished; there is nothing to resume.

### A lock file in the way

git refuses every write while an `index.lock` file exists, and a killed process, a full disk or a machine that went down mid-write leaves one behind. The panel says what is in the way and how long ago it was left, and offers **Remove lock file & retry**. Click it, the file goes, the refusal goes with it, committing starts again, and the commit you were refused is made with the message and the ticks the panel is holding.

> olai removes the file only once it is more than ten seconds old. Inside those ten seconds the button answers *A git process may still be writing; try again in a moment.* Check that no git command is running before you click.

- olai never removes the file of its own accord, and an agent has no tool for it.
- The file removed is the one in the git directory of the repository olai serves. A linked worktree's lock file lives under `.git/worktrees/<name>`.
- Where the file cannot be removed at all, the error number is drawn beside the button, rather than a claim that it was removed.
- A lock file does not stop olai reading what is waiting: `git status` answers with one in place, so what is waiting is still listed. Only the writing refuses.

</details>

<details>
<summary>Who wrote a commit</summary>

| Trailer | Who |
| --- | --- |
| `chat-agent` | an agent you chat with inside olai |
| `mcp` | anything on `/mcp`, including a command you typed with `olai surface` |
| `web` | the browser: the keyboard editor and the row's `•••` menu |
| `filer` | olai filing conversations into the Inbox |
| `auto` | the fifteen-second wait, with nobody clicking anything |
| `sleep` | a node agent's own pass over its memory ([node-agents.md](node-agents.md)) |

</details>
