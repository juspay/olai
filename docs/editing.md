# Editing with the keyboard

Click a title and the caret is in it. From there it is the outliner's loop on
the keys you already know, and the whole list is in the app, under **Keyboard
shortcuts** in the ⌘K palette.

| | |
|---|---|
| **Enter** | commit, and open the next line |
| **Tab** / **Shift+Tab** | indent under the row above, or out again |
| **Alt+Shift+↑/↓** | move a row among its siblings |
| **⌘Enter** / **Ctrl+Enter** | tick it off, or take that back |
| **⌘⇧Enter** / **Ctrl+⇧Enter** | walk the mark on: to do, then doing, then none |
| **Shift+Enter** | write the note under it |
| **↑** / **↓** | walk to the row above or below |
| **Escape** | drop what you were typing |
| **⌘Z** / **Ctrl+Z** | take back your last edit on this outline |
| **⌘⇧Z** / **Ctrl+⇧Z** | put it back |

Nothing has a mode: the title becomes an input in the same place, at the same
size, and the row you are in is toned so you can see where the caret went. What
you type is the SOURCE — `**bold**` and `#tags` as they are written — and the
rendering comes back the moment you leave. A note is the same trade one line
down.

## The three marks, from the keyboard

There are three marks and a node carries at most one of them
([format.md](format.md)) — so there are two keys, and between them they write
all three and take one off.

**⌘Enter finishes something**, and takes that back. It is the mark with an
instant on it: a `done` says when, which is what puts the work on that day's
page.

**⌘⇧Enter walks the mark on** — one step round the answers a person gives about
work they have NOT finished: a bullet, then `todo`, then `doing`, then a bullet
again. That last stop is an answer rather than a gap. A node carrying no mark is
not an unfinished one, it is a bullet, and the page draws it with no box at all;
walking to it is how you say a row was never a task, or has stopped being one.

`done` is deliberately not a stop on that ring. Finishing something is a thing
you mean, not a thing to do on the way past, so nothing stamps a completion
while you are walking round.

**And the walk will not take finished work backwards.** Press it on a row that
is done and the write is refused, in the same words an agent gets: *nothing
should decide on your behalf that finished work is not finished*. The way
through is the sentence's own — ⌘Enter takes the `done` off, and the walk
carries on from the bullet that leaves. Two presses, the second one yours; the
••• menu asks the same two clicks for the mouse, and an agent makes the same two
calls.

Every one of these is a fact about the node a row SHOWS, so pressing either key
at a mirror marks the node it stands for, and every placement of it follows.

A key is not a change to the page. Every one of them is one operation through
the same gate the agent writes through, so a row moves when the file says it
moved and two tabs on the same outline cannot disagree. What you type buffers
locally until you stop (blur, Enter, or a pause), so typing is never a round
trip; that buffer is an editor and not a claim about the file, and a write that
comes back refused — a title cannot be empty — puts the reason under the row and
leaves your text exactly where it is.

A new row is that same idea: **Enter** opens a line where the row will go, and
the node is written the moment it has a title. So an outline never fills up
with blank bullets, and a key pressed by accident writes nothing at all.

## Putting a node on a day

A node's `date` is what it is scheduled for ([format.md](format.md)), and it is
the one thing an agent could change that a person could not — so it has a
picker, in place under the row, and two ways to open one.

**A dated row's own pill is the control.** Press the date beside the title and
the picker opens on it. A row with no date has no pill to press, so its way in
is the ••• menu: **Set date…** on a row with none, **Change date…** on one that
has one.

What you get is your browser's own date picker, and what is written is the day
you picked, exactly as it is written — `2026-09-01`, ten characters, never a
timestamp this app invented on the way. **Enter** sets it, **Escape** and
**Cancel** leave without writing, and ⌘Z takes a pick back like any other edit.
Empty the box and the button becomes **Clear date**, which is the ••• menu's
own verb and the same write: one way to say "no date", whichever door you came
through.

A node scheduled for a time of day rather than a bare day keeps whatever it
says on disk until you pick — the box shows the day that time falls on, and the
panel says what picking one would replace, because a picker picks days.

The row moves the moment the file says so: a task given a day that has gone is
in Overdue on the agenda and on that day's page, without a reload and without
this page deciding anything for itself.

## Taking an edit back

**⌘Z takes back the last edit you made on this outline** — and it is not a
restore. When a key moves a row, ticks something off, or commits what you
retyped, the server records what would REVERSE it (the parent and neighbour the
row had, the mark it replaced, the words it replaced) and ⌘Z sends that, through
the same gate, judged against the outline as it is now.

Which is what makes it safe to share an outline. An undo cannot quietly take
back what the agent, another tab or a `git pull` did in the meantime; one that
no longer fits — the row moved, somebody filed work under it, somebody retyped
the line — says so instead of guessing, in the words the write gate would use.
It is your own edits, on the outline in front of you: a hundred of them, this
session, this tab. Open another outline and it starts again.

While you are still typing, ⌘Z is the text box's own, exactly as it is anywhere
else. The outline's undo starts once the line is committed, which is the moment
it became something anybody else can see.

**There is no delete key.** What ⌘Z can take back is a row you have just made —
the un-create, which is the inverse of the `Enter` that made it. Where it goes
is the Trash, keeping its id, which is what putting anything away does: a
trash rather than a shredder, refused outright once anything has been filed
under it, and not something a key of its own can ask for.

## The Trash

The `•••` menu's **Move to Trash** puts a row and everything under it away,
behind a question that names how many rows go. Where they go is
`Archive.jsonl` on disk — an outline like any other to an agent, whose tool
for the same gesture is still called `archive_node` — but to a person it is
the **Trash** at the foot of the sidebar: every archive under the directory,
readable and not editable, each subtree drawn under the chain of ancestor
titles it hung off.

Not every row in there is a thing you put away. Above each pile sit the
**titles the archive wrote down to remember where it hung** — so the tree still
reads years later — and those are signposts rather than nodes: the ones they
name never left. Pressing **Put back** on a signpost says so, and names the
live row that still carries the title. What comes back is what went in.

**Put back** is the one verb a Trash row has, and it is the whole reason the
Trash is a trash. It sends the same `unarchive` op an agent's
`unarchive_node` sends — the op both faces got in the same change, because
neither face may do what the other cannot — and the subtree returns where
the recorded chain says it came from, last among its new siblings, children
and ids intact. A chain that no longer stands (retitled, or put away itself)
is a refusal in the ops layer's own words under the row, never a guess; an
agent can name a destination outright, and restoring the chain first is the
way through for the mouse. ⌘Z after a Move to Trash puts the row back too —
the undo knows the exact parent it sat under — and ⌘Z after a Put back is
the archive again.

Deliberately absent, each its own item: delete, split and merge, multi-select,
and drag-and-drop.
