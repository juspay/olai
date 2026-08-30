# Live properties

Most of what a board records is inert: a title, a date, a URL, a path. Some of it is not. A property whose value is a **name somebody decided on** — a terminal's id, a checkout's path — names a thing that is still going on somewhere, and a value like that can be given a face that **updates on its own**.

The board goes on storing the name. The display goes and finds out what that name currently is.

This page is the seam itself, and it is generic: what a live property is, what turns one on, and the two shapes a face can take. What each face DRAWS is its plugin's, and each plugin's own page has it in full.

## What is live today

| the kind | what it wears | whose page |
| --- | --- | --- |
| `terminal` | kolu's own Dock row, and the live read-only pane it opens | [plugins/kolu.md](plugins/kolu.md) |
| `worktree` | a CI chip while a run is going in that checkout, and the run matrix it opens | [plugins/odu.md](plugins/odu.md) |

They are the same mechanism wearing different clothes, and a third kind of living thing later is a third set of clothes rather than a third mechanism.

## What turns one on is a DECLARATION, never the key's name

The rows above name **kinds**, not keys. The key a vault hangs each on is the vault's own: one row in `_olai/Properties.olai` says which of your columns is which kind, and everything follows that row.

```jsonl
{"id":"prop-terminal","ord":"a0","title":"terminal","custom":{"type":"terminal"}}
{"id":"prop-worktree","ord":"aC","title":"worktree","custom":{"type":"worktree"}}
```

So a column called `pty` gets the terminal door the day its row says `terminal`, a column called `checkout` gets the CI chip the day its row says `worktree`, and **a vault that declares nothing gets neither** — where a property happening to be spelled `terminal` used to be enough. The repair is always the same one row ([format.md](format.md#what-a-declared-value-names)).

**It used to be enough to name the key, and that was not enough.** Name-matching cannot tell two path-shaped columns apart: `brief` and `worktree` are both declared `path`, they sit on the very same rows, and only one of them names a checkout to dial a socket in. Declaring `path` therefore buys neither face now, and there is deliberately **no fallback to the key's name** beside the declaration — a fallback would be the same defect kept alive under a second name. This hands a value to a probe on your machine, and only the vault can say which of its keys is one.

## Two shapes, and the difference is whether the thing is worth a row when nothing is happening

**A block OWNS ITS ROW.** A `terminal` somebody wrote down is worth a row whether or not anything is going on in it — there is always something to say, including *this terminal is no longer in the fleet*.

**A chip sits BESIDE THE VALUE** and appears only while there is something to say. A `worktree` is a path on a lane row, quiet by default; its CI chip is there while a run is going and gone the rest of the time. A board with no CI running looks exactly as it did.

The chip's press opens a **pane** beneath the property run — one at a time per node, mounted only while it is open, so a page of twelve lanes with one live run has one clock ticking on it.

## What a live face is allowed to be

**Reading, never a hand on the thing.** A live pane is read-only and a run matrix has no buttons in it: watching something must not perturb it. A readout that quietly grew a verb would be the one thing these integrations must not do.

**No tab dials anything.** The SERVER holds the one connection or takes the one reading, and every browser is a subscriber to it. Twelve tabs on a lanes outline are twelve readers of **one** sweep.

**We cannot see is never drawn as we looked and it is quiet.** An absence is a state with its own words, not a greyed-out row claiming the thing is sitting there idle — the two have opposite fixes, and each plugin's page lists the sentences it says.

## When a plugin is off

Live properties come from plugins, and a serve can be run without one (`--plugins` — [running.md](running.md)). A kind whose plugin is not running validates as **plain text**: the value is still a name, the file is still fine, nothing breaks, and it wears no face. That is exactly the state a vault that declared nothing is already in.

A DECLARATION is judged differently from a VALUE, and the difference is worth knowing before you go looking for a bug: `{"type":"terminal"}` is a clean row on a serve running only odu, because a file's verdict may not depend on a flag on the machine reading it. Only the FACE is missing.
