# Fixture corpora

One directory per corpus. A scenario picks one with a `@corpus:<name>` tag, and
`support/hooks.ts` starts a server on that directory the first time some
scenario asks for it (see the header there). Nothing in this file is served —
only the corpus directories below it are.

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

Two outlines and one attached document. Between them they exercise one of each
thing the view has to draw:

| what | where |
|---|---|
| nesting | `kitchen` → `install` → `handles` (house.jsonl) |
| a done child | `demo` (house.jsonl:2) |
| a doing child | `order` (house.jsonl:3) |
| a derived status | `kitchen` is `doing` — it stores nothing; its children say so |
| an inline `#tag` | `kitchen remodel #home`, `garden #outdoors` |
| a `date` | `order` is dated `2026-08-10` |
| a markdown `desc` | `order` — a paragraph, a two-item list, bold and italic |
| an `after` edge | `order` after `demo`; `install` after `order` |
| a `doc` | `install` attaches `finishes.md` |
| a cross-file mirror | `kitchen-herbs` (house.jsonl) mirrors `herbs` (garden.jsonl) |

The mirror is why there are two files. Every `.jsonl` is an independent tree —
a `parent` may not cross files — so showing the herb bed inside the kitchen
remodel is exactly what a mirror is *for*, and it is the one relation that
cannot be exercised with a single file.

Note what is absent: no `done` or `doing` on `kitchen`, `install` or `herbs`. A
node with children never stores its status; it is computed from them, and
storing one is a load error.

## `journal/` — a set with dates in it

Two outlines whose nodes carry `date`, for the month in the sidebar and the day
view. Neither file is a journal and neither is named like one: that is the
point, since a day is a query over the whole set.

| what | where |
|---|---|
| one day, two outlines | `2019-11-05` has `ferry` (life.jsonl) and `posts` + `rails` (work.jsonl) |
| a bare date and a datetime on the same day | `posts` is `2019-11-05`, `rails` `2019-11-05T14:30` |
| a datetime that must count for its own day | `ferry` is `2019-11-05T09:00` |
| a day with one node | `2019-11-06` — `pack` |
| a day in the month before | `2019-10-28` — `survey`, which is what paging back finds |
| a dated node with a note, a tag and a derived status | `posts` (`doing`), `rails` (`#home`) |
| undated nodes, which no day may collect | `deck`, `trip`, `sweep` |

**The dates are in 2019 on purpose.** A calendar is one of the few things whose
behaviour depends on what day it *is*, and `features/journal_and_calendar.feature`
has a scenario that asserts `/today` is empty. Dating the fixtures to a year
that has already happened is what keeps that scenario honest on every day it
will ever run.

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
