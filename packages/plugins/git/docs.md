# git

Records what olai writes as git commits, and sends them on.[^brings]

## What turns it off

The row is on by default and needs the vault. Set `on: no` on the `git` node in `_olai/Settings.olai`, or use its switch, **Git** under **Notes** on the plugins panel ([../settings.md](../settings.md)).

With it off you have an outliner whose writes wait for nobody: no Commit readout, no commit panel, and no git tools for an agent.[^writes]

## Settings

`commit` and `push` on the `git` node say how much happens without you; every value is in the closed block at the foot of this page.[^live]

## The tools an agent gets

| Tool | What it does |
| --- | --- |
| `git_commit` | Records everything waiting as one commit, or only the paths it passes. An omitted `message` is composed from what changed |
| `git_push` | Fetches the upstream, rebases what is unpushed onto it, and pushes, never forcing |

A commit sweeps the whole repository.[^sweep] `git_push` takes a plain divergence in and reports it as `integrated`.[^refuse]

## What the browser gets

The Commit readout is a row of the health-dot popover, and the dot wears the readout's own state.[^dot] Four verbs are the browser's, not an agent's: commit, push, resume, and unlock.[^unlock]

[^brings]: What the row brings: the Commit readout in the header, the commit panel, and the `git_commit` and `git_push` tools. [../git.md](../git.md) is how you use them.

[^writes]: Writes still land on disk with the row off, and anything that asks is told `nobody is recording writes here, so there is nobody to record a write`.

[^live]: Both settings take effect without restarting the row. The row keeps its readout, its open panel and any pause or refusal it is holding. olai logs the policy at boot and at every change, as `git: commit=<mode> push=<mode>`, saying whether the quiet window is armed.

[^sweep]: What a commit sweeps: every file that differs from `HEAD`, including one a person edited by hand, and anything untracked that `.gitignore` does not cover. An agent cannot see what is pending.

[^refuse]: What `git_push` refuses: a conflict, naming the files, a fetch or push the remote refused, and an uncommitted edit in a path the upstream changed.

[^dot]: The health dot asks for attention while writes wait or commits are unpushed, and raises an alarm on a git error, a refused push or a paused loop. **Commits off** and **Not a git folder** leave the dot alone. On a phone the same news arrives as a banner under the header.

[^unlock]: Why unlock belongs to the browser: removing a stale `index.lock` is a person saying they have checked that no git command is running, which is not an agent's judgement to make.

<details>
<summary>Every value of <code>commit</code> and <code>push</code></summary>

Properties on the `git` node.

| Key | Values | Default | What it means |
| --- | --- | --- | --- |
| `commit` | `off`, `manual`, `auto` | `manual` | `manual` waits for somebody to ask. `auto` records what is waiting once writes stop arriving for fifteen seconds, whoever made them. `off` means olai never touches git here |
| `push` | `off`, `auto` | `off` | `auto` sends what has been recorded. `off` leaves the Push button as the only way |

`commit: off` keeps the row mounted and records nothing; `on: no` takes the row, its readout and its tools away. Moving `push` from `off` to `auto` sends the commits already recorded here, once.

</details>
