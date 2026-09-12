# The ledger

Git is a plugin. Everything about recording what olai wrote — the pill in the header, the phone banner, the commit panel, the `git_commit` and `git_push` tools, and the two cells an agent used to read as `surface://cells/git` and `surface://cells/pending` — arrives with one row in the build's plugin list. A serve that does not name that row has none of it: writes still land on disk, and nobody records them.

What git *does* has its own page: [git.md](../git.md) is the feature. This page is about the row.

## What turns it on

The `git` row is on by default. Set `on: no` on its top-level node in `_olai/Settings.olai`, or use its switch on `⧉`. The switch writes the same property and restart reads it again.

```jsonl
{"id":"git","ord":"a0","title":"git","custom":{"on":"no"}}
```

**Either way you are left with an outliner whose writes wait for nobody.** There is no pill, no `surface/git/` on the wire, and nobody to record a write — not a disabled version of any of them, an absent one.

## The config

The row's `Config` schema declares `commit` (`manual` by default) and `push` (`off` by default), with validation and descriptions. Properties on the `git` node supply values; the reader derives the panel's vault/default authors and the composition root re-applies edits. `olai.yml` carries no config block. `commit: off` keeps the ledger mounted but disables recording; `on: no` removes the provider and its UI and tools.

See [running.md](../running.md#the-git-policy).

## The door, and where it is told about

This row stands behind `Ledger`, and it TELLS THE VAULT about the same door
through `vault-views`. The vault's settings carry a ledger — where a write is
recorded — and the vault cannot name this key: this row waits for `Vault`, so
the reverse edge would be a cycle. It used to be a lookup at the far end, over
the whole host, for a key the vault never declared; the arrow points this way
now, which costs this row no wait it did not already have. The registration
unwinds with this activation, so a vault outliving the ledger falls back to
refusing in its own words.

## In the browser

The desktop pill uses `app.header`. The phone notice uses `app.banner`, which the shell draws in normal flow directly below the header, before the page content. It disappears when no work or warning remains. This keeps its commit entry reachable while an agent conversation is open.

## On the wire

Git's members compose as a sibling, under its own key:

- `surface/git/git` — what git is doing for this directory
- `surface/git/pending` — what is waiting
- `surface/git/git/commit`, `surface/git/git/push`, `surface/git/git/resume` — the three verbs

They are on the browser face. The MCP tools an agent calls are `git_commit` and `git_push` — the row's word in front of its own verb, on every face (#546) — and they are THIS ROW'S now (`packages/plugins/git/src/tools.ts`, juspay/olai#546): they used to be two entries in `@olai/ops`' one closed table, which meant a serve with no ledger row still advertised them. They do not land on the sibling verbs above; they call through the ops layer's own ledger door, which this row stands behind when it is mounted and which refuses in words when it is not. So the row still puts nothing on the agent face. An agent cannot see what is pending, and `git_commit` records everything waiting unless it passes `paths`. The `surface://cells/git` and `surface://cells/pending` URIs are gone with them. The adapter HAS a sibling segment now (juspay/kolu#2234, so a row's resource reads `surface://cells/<row>/<member>`), and that is no longer what would keep them off the face: this row publishes no `resources` map, which is the decision rather than a limitation. An agent observes the recorder through `git_commit` and `git_push`.

## Where it hangs in the tab

| seat | who declares it, and what they keep | what git brings |
| --- | --- | --- |
| `app.header` | `layout` — where in the bar cluster a readout sits | the Commit pill |
| `app.banner` | `layout` — where a banner sits over the page | the phone banner (news only) |

The panel travels with the pill, portalled against the viewport, the way it always did.
