# Fixture corpora

One directory per corpus. A scenario picks one with a `@corpus:<name>` tag, and
`support/hooks.ts` starts a server on that directory the first time some
scenario asks for it (see the header there). Nothing in this file is served —
only the corpus directories below it are.

`outside.png` is the exception that proves it: a real picture sitting HERE,
one directory above every served root, so that the traversal scenario in
`features/documents.feature` refuses a URL because it climbs and not because
there is nothing at the end of it.

These directories are **read-only to a scenario**. A scenario that has to edit
the files — everything in `features/it_stays_live.feature` — asks for
`@scratch:<name>` instead and is served a private temp copy by a server of its
own. Writing into the tree below would leave the next scenario reading a
fixture the repository does not contain.

The fixtures are meant to be read. A person who wants to know what a valid
outline looks like should be able to answer it from `good/` in under a minute,
and a person who wants to know what a *good error* looks like should get it
from `broken/` and `tangled/`.

## `good/` — a set that validates

Three outlines, three documents and a picture. Between them they exercise one
of each thing the view has to draw:

| what | where |
|---|---|
| nesting | `kitchen` → `install` → `handles` (house.jsonl) |
| a done child | `demo` (house.jsonl:2) |
| a doing child | `order` (house.jsonl:3) |
| a todo child | `knobs` — an unstarted task nothing is waiting on, so an EMPTY box |
| a todo child that is BLOCKED | `hinges` — the waiting glyph in the mark column instead, and the row dimmed |
| a parent the done toggle must not hide | `frames` (garden.jsonl) — both its tasks done, and NOBODY marked it |
| a note that must survive the done toggle | `slugs` under `frames` — nobody finished it, nobody called it work |
| a bullet that is not a task | `handles` — no mark, so no status and no box at all |
| a marked parent | `kitchen` is `doing`, `herbs` is `doing` — stored, like any other mark |
| a rollup | `kitchen` shows `1/2`: `demo` done, `order` under way, `install` not a task |
| an inline `#tag` | `kitchen remodel #home`, `garden #outdoors` |
| a `date` | `order` is dated `2026-08-10` |
| a markdown `desc` | `order` — a paragraph, a two-item list, bold and italic |
| an `after` edge that BLOCKS | `hinges` after `order`, which is under way — so `hinges` cannot start |
| two `todo` leaves, one blocked and one not | `hinges` and `knobs` under `install` — the whole difference the mark column draws |
| an `after` edge that is clear | `order` after `demo`, which is done — nothing left to wait for |
| an `after` edge that must NOT block | `hinges` after `handles`, a bullet nobody marked: not work, so nothing to wait for |
| a `doc` | `install` attaches `finishes.md` |
| a document nothing attaches | `notes/palette.md` — still a page, still in the sidebar |
| a nested outline | `Daily/2026-08.jsonl` — the sidebar's file tree, not a path string |
| a fenced code block, a footnote | `finishes.md` |
| every mark the markdown pipeline draws, once each | `kitchen-sink.md` |
| a relative picture | `finishes.md` names `art/handle.png`; `notes/palette.md` names the same file through `../` |
| a cross-file mirror | `kitchen-herbs` (house.jsonl) mirrors `herbs` (garden.jsonl) |

`kitchen-sink.md` is the odd one out and says so in its own first paragraph: it
is not there to be a plausible document but to be LOOKED AT, in a light theme
and a dark one, by whoever is changing how markdown is set. Only the few of its
claims that can go silently wrong are asserted
(`features/documents.feature`) — the rest are for the eye.

The mirror is why there are two files. Every `.jsonl` is an independent tree —
a `parent` may not cross files — so showing the herb bed inside the kitchen
remodel is exactly what a mirror is *for*, and it is the one relation that
cannot be exercised with a single file.

The marks on the parents are the point rather than an oversight. `kitchen` and
`herbs` carry their own, because a mark is a stored fact on whatever carries it
— children or not — and nothing is computed from what hangs below (resolved
2026-08-11). `install` carries none, and that is a second real state: a `todo`
child does not make it a task, so it draws no box at all, exactly like a note.

`frames` is the case worth reading twice, because it is the bug this model
replaced. Nobody marked it; both of its task children are done; a plain note
(`slugs`) hangs beside them. Deriving a status made it read `done`, so the done
toggle hid the branch and took the note with it — the view whose job is showing
what is left hiding exactly what was left. Now the two done rows go and `frames`
and `slugs` stay.

The `after` edges are one rule read three ways, and `hinges` carries two of
them at once: `b` blocks `a` while `b` is a task that is *not done*, so `order`
(under way) holds `hinges` up while `handles` — which nobody marked — never
blocked anything to begin with, and `demo` (done) has cleared the way for
`order`. Reading the `handles` edge as an obstacle would be reading every plain
bullet as work that can never be finished. Both ends of the blocking edge carry
a mark somebody wrote, so what the scenarios assert is the rule rather than
anything about the nodes' children.

## `chat/` — a set the agent writes to

Deliberately plain: one outline, one parent, three children of it — one done,
one under way, one carrying no mark at all. Everything
`features/the_agent.feature` asks for is a property of that shape rather than
of anything ornamental in it:

| what | where |
|---|---|
| a leaf the agent can mark | `order` — a bullet, so marking it is what makes it a task |
| a leaf that is already done | `demo` |
| a leaf still under way | `install` |
| a parent to mark | `kitchen` — an ordinary write, answered with a nudge naming `install` |

The third child is the model in one line: `order` carries no mark, so it is a
bullet rather than a task nobody has started, and the nudge above does **not**
name it — an unmarked child is not an unfinished one (docs/format.md's Status
section). `install` is the one task still open under `kitchen`, and it is the
whole of what the nudge names.

Every chat scenario is `@scratch:chat`, because the agent WRITES: it is served a
private temp copy with a server of its own, and both go away with the scenario.

## `journal/` — a set with dates in it, and a vault of daily notes

Two outlines whose nodes carry `date`, for the month in the sidebar and the day
view. Neither OUTLINE is a journal and neither is named like one: that is the
point, since a day is a query over the whole set.

Beside them is the one filename that does mean something — a `Daily/YYYY/MM/`
tree of documents, laid out the way the human's own vault is, for
`features/daily_notes.feature`:

| what | where |
|---|---|
| a daily note on a day that also has nodes | `Daily/2019/11/2019-11-05.md` — the composition: the note first, `ferry`/`posts`/`rails` below |
| a relative `.md` → `.md` link, climbing three directories | that same note → `../../../notes/ferry.md`, whose target is `notes/ferry.md` |
| a daily note on a day with NO dated nodes | `Daily/2019/11/2019-11-08.md` — a note-day is a link, and does not claim to be empty |
| a document that merely NAMES a date | `Daily/2019/11/2019-11-09-recap.md` — so the 9th stays inert |
| TWO documents claiming one date | `Daily/2019/11/2019-11-12.md` and `notes/2019-11-12.md` — a vault mid-migration, both listed in path order |
| a day with neither | the 7th — still inert, which is the no-write-affordance stance surviving |

The link is written with `..` on purpose. The note is drawn on `/d/2019-11-05`,
which is not a file at all, so a link left relative would be resolved by the
browser against the ROUTE; the base is the note's own directory, and the only
way to say so is a path that climbs out of it.

The two claimants sit in *different* folders on purpose too — the old note where
the vault used to keep them, the new one under `Daily/` — because that is the
directory the design named, and because path order has to be a real order
between them rather than two names in one folder.

| what | where |
|---|---|
| one day, two outlines | `2019-11-05` has `ferry` (life.jsonl) and `posts` + `rails` (work.jsonl) |
| a bare date and a datetime on the same day | `posts` is `2019-11-05`, `rails` `2019-11-05T14:30` |
| a datetime that must count for its own day | `ferry` is `2019-11-05T09:00` |
| a day with one node | `2019-11-06` — `pack` |
| a day in the month before | `2019-10-28` — `survey`, which is what paging back finds |
| a node scheduled one day and FINISHED another | `survey`: `date` `2019-10-28`, `done` `2019-10-29`, so it is on both, once each |
| a dated `todo`, which no day reads | `filed` is `todo: 2019-11-21`, and the 21st is inert — only `date` and a dated `done` place a node |
| a dated node with a note, a tag and a mark | `posts` (`doing`), `rails` (`#home`) |
| undated nodes, which no day may collect | `deck`, `trip`, `sweep` |

**The dates are in 2019 on purpose.** A calendar is one of the few things whose
behaviour depends on what day it *is*, and `features/journal_and_calendar.feature`
has a scenario that asserts `/today` is empty. Dating the fixtures to a year
that has already happened is what keeps that scenario honest on every day it
will ever run. The one scenario that needs a note on TODAY writes one, under
`@scratch:journal` — a day nobody knows in advance cannot be a tracked file,
and writing it is also the honest test of a `.md` dropped into the directory
while a page is open.

## `agenda/` — a set with something owed in it

Two outlines whose dates are all in the past, for `features/agenda.feature`.
The agenda reads `date` and the mark TOGETHER, so this corpus is one of each
pair they can make:

| what | where |
|---|---|
| a `todo` whose day has gone | `posts` — `2019-11-05`: overdue |
| a `doing` whose day has gone | `permit` — `2019-10-30`: overdue too, and the older of the two, though written after it |
| a dated bullet | `delivery` — `2019-11-02` with no mark: an OCCURRENCE, and never late |
| finished work with a date on both fields | `survey` — on the 1st and the 4th's day pages, and on no agenda |
| work with no `date` at all | `paint` — a `todo` nobody scheduled, so there is no *when* to be late against |
| a date on the MARK and nowhere else | `latch` — `todo: 2019-11-21`, which no view reads as a day |
| overdue AND blocked | `visas` (life.jsonl) — after `photos`, which is under way, so the row says both |
| the blocker itself | `photos` — `doing` and undated, so it holds `visas` up without being on the agenda |

**The dates are in 2019 for the reason the journal corpus's are** — everything
here is overdue on every day this suite will ever run, and today and the days
ahead are empty until a scenario writes into them, which the `@scratch:agenda`
scenarios do.

Two outlines, again for one reason: the agenda groups by outline within each of
its sections, and one file cannot show a grouping. `visas` (life.jsonl) is
dated between `permit` and `posts` (work.jsonl), so the two orders — path order
across the groups, oldest first inside one — cannot both be satisfied by
accident.

## `broken/` — a set that does not parse

- `pantry.jsonl:3` — an unquoted key, so the line is not JSON (`not-json`).
- `shed.jsonl:2` — `parent` is `shhed`, which no node declares
  (`unknown-parent`, with `shed` as the did-you-mean).

A file with an unreadable line contributes no nodes, and the set-wide rules run
over what is left. `shed.jsonl` is what makes this corpus a whole-set failure
rather than a degrade: `parent` may not cross files, so `shhed` is refused
whichever file it was going to be in, and an error the missing file cannot
explain rejects the set. The parse error is reported alongside it — one pass
should be enough to fix a directory.

Compare `features/it_stays_live.feature`, where the *only* thing wrong is a file
that will not parse: there the set is published with that one outline degraded
in place, and everything else stays live.

## `tangled/` — a set that parses and does not mean anything

Every line here is valid JSON and a well-formed record, so the whole-set
validator definitely runs. That is the point: this is where the error view's
*grouping* is exercised, and grouping needs errors in more than one file.

- `attic.jsonl:3` — `after` names `donate`, which nothing declares
  (`unknown-target`) → belongs to `attic.jsonl` alone.
- `cellar.jsonl:2` — `parent` is `attic`, which lives in `attic.jsonl`
  (`foreign-parent`) → **cross-file**: it names a site in the other file.
- `cellar.jsonl:3` — a second `boxes`; `attic.jsonl:2` claimed it first
  (`duplicate-id`) → **cross-file**.
- `cellar.jsonl:4` — `parent` is `nowhere` (`unknown-parent`) → belongs to
  `cellar.jsonl` alone.

An error is cross-file when it implicates a second file — `isCrossFile` in
`packages/format/src/errors.ts` — which is what the `cross-file-errors` section
of the error view collects.
