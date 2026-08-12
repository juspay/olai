# Agenda: due dates as a reading, not a field

*Ratified 2026-08-12. The UX of due dates — "agenda, basically" — resolved in
the app's own grammar.*

## The core move: no new field

An agenda conflates two questions the format already keeps apart: `date` says
*when*; the mark says *whether it is work*. Read together, they resolve without
a third field:

- `date` + **no mark** = an *occurrence* — a birthday, an appointment, a note
  pinned to a day. It can never be overdue; a day passing is not a failure of a
  bullet.
- `date` + **`todo`/`doing`** = *due work*. This is the only thing that can be
  late, because someone said it was work and said when.

**Why the alternative lost:** a separate `due` alongside `date` would be two
dates answering one question — exactly the disagreement the mirror shape exists
to make unrepresentable. And the reading inherits the format's crown rule for
free: a bare dated bullet is not late work, for the same reason an unmarked
node is not an unfinished one. Nothing here is a default coming back; someone
has to put the mark there.

## Overdue is the next `blocked`

Derived at view time, stored nowhere, spelled once:

    overdue(n) ⇔ n carries todo or doing  ∧  day(n.date) < today

`day()` is the first ten characters; the comparison is plain string order, here
as everywhere — dates are text. It is a *second fact* about a node, never a
replacement for its mark (the same sentence `format.md` uses for blocked), and
it slots into the same column: *has this started, can it start, should it have*
are three answers about one node. `done` extinguishes it by construction — a
finished task is late at nothing.

The one visible change outside the agenda: the date badge shifts to the
attention tone wherever the predicate holds, on every row the pill is drawn.

## The page: `/agenda`, a query, not a place

Exactly as `/d/<date>` is a question asked of every node in every outline, the
agenda is the forward question — nothing on disk is the agenda. Three sections,
grouped by outline within each, because that is the only heading that is true:

1. **Overdue** — every overdue node in the set, oldest first. This section *is*
   the feature: a slipped task is on no day anyone visits, so it is the one
   answer no day page can give.
2. **Today** — what today's day page computes, minus finished work.
3. **Upcoming** — the next days that have anything, each heading a link to its
   day page. Days with nothing do not appear.

An occurrence keeps its place on the agenda — it draws no checkbox, its pill
never turns amber, and when its day passes it simply leaves. A blocked task
keeps both its answers, drawn together, as the format already requires. Undated
tasks are absent entirely: they have no *when*, and inventing one is what this
format refuses to do. An empty agenda says "Nothing is due." and offers nothing
to press.

## What it deliberately is not

- **Not the journal.** Day pages answer *what happened*; the agenda answers
  *what is owed*. `done` never appears on it.
- **Not Now.** Now is a person curating with mirrors — *chosen* work; the
  agenda is derived — *dated* work. They are complements, and neither writes to
  the other.
- **No snooze, no recurrence.** Rescheduling is `set_date`. Recurrence would be
  a real format change and deserves its own debate, not a rider on this one.

## Rulings

- **`doing` belongs in Overdue** (human, 2026-08-12): the agenda asks "should
  this have happened by now?", and started-but-unfinished is the most honest
  yes. The predicate is `todo ∨ doing`, spelled once. The narrower reading
  (only `todo` is "due") was considered and declined.
- No new field; no format change at all. One derived predicate, one query page,
  one badge tone.
