# The git plugin: commits, pushes and its two settings

The `git` plugin records what olai writes to your files as git commits, and pushes them to the remote repository.[^brings]

## What turns it off

The plugin is on by default and needs the vault, the plugin that opens the directory olai serves. Set `on: no` on the `git` row in `_olai/Settings.olai`, or use its switch, **Git** under **Notes** in the plugins panel ([../settings.md](../settings.md)).

With it off, nothing is committed: no Commit readout in the header, no commit panel, and no git tools for an agent.[^writes]

## Settings

The two settings are `commit` and `push`, written as properties on the `git` row. Every value they take is in the block at the foot of this page.[^live]

## The tools an agent gets

| Tool | What it does |
| --- | --- |
| `git_commit` | Records everything waiting as one commit, or only the paths it passes. When it passes no `message`, olai writes one from what changed |
| `git_push` | Fetches the upstream branch, rebases the commits you have not pushed onto it, and pushes, never forcing |

A commit includes every change in the repository, not only what olai wrote.[^sweep] Where the remote has commits you do not, `git_push` rebases onto them and reports `integrated`.[^refuse]

## What the browser gets

The Commit readout, the line in the header that says what is waiting to be committed, also appears in the popover the health dot opens, and that dot shows the readout's state.[^dot] Four actions belong to a person at the browser and not to an agent: commit, push, resume and unlock.[^unlock]

[^brings]: What the plugin brings: the Commit readout in the header, the commit panel where you commit, and the `git_commit` and `git_push` tools. [../git.md](../git.md) is how you use them.

[^writes]: Writes still land on disk with the plugin off, and anything that asks to commit is told `nobody is recording writes here, so there is nobody to record a write`.

[^live]: Both settings take effect without restarting the plugin. The plugin keeps its readout, its open panel and any pause or refusal it is holding. olai logs both settings at startup and at every change, as `git: commit=<mode> push=<mode>`, and says whether it is set to commit once writes stop.

[^sweep]: What a commit includes: every file that differs from `HEAD`, including one a person edited by hand, and any file git is not tracking that `.gitignore` does not cover. An agent cannot see what is waiting to be committed.

[^refuse]: `git_push` refuses three things. A conflict, naming the files it conflicts on. A fetch or a push the remote refused. An edit you have not committed in a file the upstream branch changed.

[^dot]: The health dot, the small coloured dot in olai's header, asks for attention while writes are waiting to be committed or commits are waiting to be pushed. It raises an alarm on a git error, a push the remote refused, or committing that has stopped after a refusal. **Commits off** and **Not a git folder** leave the dot alone. On a phone the same news arrives as a banner under the header.

[^unlock]: Why unlock belongs to the browser: deleting a leftover `index.lock` file is a person saying they have checked that no git command is running, which is not a judgement for an agent to make.

<details>
<summary>Every value of <code>commit</code> and <code>push</code></summary>

Properties on the `git` row of `_olai/Settings.olai`.

| Key | Values | Default | What it means |
| --- | --- | --- | --- |
| `commit` | `off`, `manual`, `auto` | `manual` | `manual` waits for somebody to ask. `auto` records what is waiting once writes stop arriving for fifteen seconds, whoever made them. `off` means olai never touches git here |
| `push` | `off`, `auto` | `off` | `auto` sends what has been recorded. `off` leaves the Push button as the only way |

`commit: off` keeps the plugin running and records nothing. `on: no` takes the plugin, its readout and its tools away. Changing `push` from `off` to `auto` sends the commits already recorded here, once.

</details>
