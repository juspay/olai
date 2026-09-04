# The ledger

Git is a plugin. Everything about recording what olai wrote — the pill in the header, the phone banner, the commit panel, the `commit` and `push` tools, and the two cells an agent used to read as `surface://cells/git` and `surface://cells/pending` — arrives with one row in the build's plugin list. A serve that does not name that row has none of it: writes still land on disk, and nobody records them.

What git *does* has its own page: [git.md](../git.md) is the feature. This page is about the row.

## What turns it on

Nothing. It is on by default, like chat and the appliances. Two things take it away, and they answer two different questions.

`--plugins` decides what a serve **comes up with**:

```
olai web ~/outlines                                  # the pill, as always
olai web ~/outlines --plugins=chat,kolu,odu          # writes land, recorded by nobody
```

The plugins panel — `⧉` in the header — turns it off and on **while the serve runs**, and that lasts as long as the process: a restart comes back to the flag. Switched off at the panel, the pill leaves while you are watching, and `ops.commit` refuses in words.

**Either way you are left with an outliner whose writes wait for nobody.** There is no pill, no `surface/git/` on the wire, and nobody to record a write — not a disabled version of any of them, an absent one.

## The pin

`--commit` and `--push` are this row's policy, not a mode of core. They are the same flags they were: omitted is the built-in default (`manual` / `off`); a given flag is named on the git cell. Turning the plugin off is a different fact from `--commit=off`: off is "no provider mounted", so there is no pill and no tool; `--commit=off` with the row on is a mounted ledger that has been told not to record.

See [running.md](../running.md#the-git-policy).

## On the wire

Git's members compose as a sibling, under its own key:

- `surface/git/git` — what git is doing for this directory
- `surface/git/pending` — what is waiting
- `surface/git/git/commit`, `surface/git/git/push`, `surface/git/git/resume` — the three verbs

They are on the browser face, and `git` / `pending` / `commit` / `push` are on the agent face too. The MCP tools an agent calls are still named `commit` and `push` — they are the ops table's, landing on these sibling verbs when the row is mounted and refusing in words when it is not. The `surface://cells/git` and `surface://cells/pending` URIs leave with core's members; the adapter has no sibling segment.

## Where it hangs in the tab

| seat | what the shell keeps | what git brings |
| --- | --- | --- |
| `app.header` | where in the bar cluster a readout sits | the Commit pill |
| `app.mount` | the fold that wraps the page | the phone banner (news only) |

The panel travels with the pill, portalled against the viewport, the way it always did.
