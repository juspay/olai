# Editing with the keyboard

Click a title and the caret is in it. From there it is the outliner's loop on
the keys you already know, and the whole list is in the app, under **Keyboard
shortcuts** in the ⌘K palette.

| | |
|---|---|
| **Enter** | commit, and open the next line |
| **Enter, mid-line** | split the row in two, there |
| **Backspace, at the start** | join this row onto the one above |
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

## One row into two, and two into one

**Enter in the MIDDLE of a line cuts it there.** What is before the caret stays
where you were; what is after it becomes the next row, and the caret goes with
it, at its head — those are the words that moved. Everything that DESCRIBED the
row you were in stays with it: what hangs under it, its note, its mark, its
date, what it waits on. The line that came off is a new row, and a new row is a
bullet — nobody has said anything about it yet, and this app does not decide
that for you.

At the END of a line the key is what it always was, because there is nothing
after the caret to split off. At the HEAD of one it is that too, and that is a
decision worth saying out loud: an outliner you have used would put a blank row
above, and here there is no blank row to put — a node needs a title
([format.md](format.md)) — so nothing is written that the write gate would have
to refuse. Cutting where one side would be nothing but spaces is the same thing
for the same reason, and reads the same way.

**Backspace at the START of a line joins it onto the row above** — its sibling,
the row your eye is on. The two titles run together with nothing between them,
because that is what they were before somebody cut them; the caret lands on the
seam. Anywhere else in the line, Backspace is the ordinary one and deletes a
character; it means this only in the one place it has nothing of its own to do.

What happens to the rest of the row is the whole of the semantics, and there
are no silent losses in it:

- **what hung under it is adopted** by the row above, in order, at the end of
  what was already there. Nothing is orphaned by a keystroke.
- **the notes join**, one blank line apart, and a row with no note simply takes
  the other's.
- **its mark, its date, the document on it and what it waits on go with its
  record to the Trash.** A node carries at most one of each and the surviving
  row already has its own answer, so there is nothing to merge — and the record
  is not destroyed: it is in the Trash with its id, and **Put back** returns it.
  What you get instead of silence is a line under the row saying what went,
  because a `done` leaving the outline is exactly the thing nobody should have
  to notice for themselves.

The first row of a level has nothing above it to join, and a row above that is
a mirror has no title of its own to join onto; both say so under the row, in the
ops layer's own words. **Neither key works at a mirror**, and that is the same
sentence read once more: a mirror is a second placement of a node that lives
somewhere else, so cutting one in two would put the half that came off beside
that node, in a file you do not have open — the two halves of your sentence
would stop being neighbours. Both refuse there, naming the node to go to.

**A line you have only just started counts.** Neither key needs the row to have
been saved: what you typed is written first, exactly as walking away from it
would have written it, and then it is cut or joined. So `Enter`, a few words,
`Home`, `Backspace` puts them on the line above — which is what that gesture
means everywhere else.

**⌘Z takes either back.** The undo of a split is the merge that puts the two
halves back together; the undo of a merge is longer and does the whole thing —
the record out of the Trash, back where it sat, its children back under it, and
the joined title cut back to what it said. Judged against the outline as it is
now, like every other undo below, so an undo that no longer fits says so rather
than guessing.

Both keys are ONE write at the same gate everything else goes through, and an
agent has them too — `split_node` and `merge_node` are the same two ops. That
matters more here than anywhere else on this page: a merge moves four rows and
puts a record away, and it either happens whole or does not happen.

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

Deliberately absent, each its own item: delete, multi-select, and
drag-and-drop.

## Writing a document

A `.md` under the served directory has always had a page; the page can be
written now. **Edit**, on its header, turns the rendered body into its SOURCE
— a textarea holding the file verbatim, which is the same trade every title
and note makes: what you type is the source, and the rendering comes back
when you leave. There is no toolbar and no WYSIWYG, because a document is
markdown and markdown is text.

The mode is declared, so leaving it is too — which is where a document
differs from a note, and on purpose. A note is one line, entered by a click
and committed on blur; a whole file written because a click strayed is a
write nobody asked for. So **Save** commits (⌘Enter / Ctrl+Enter from the
editor), **Cancel** abandons (Escape), and nothing commits on a timer — a
document mid-edit is often half a sentence, and every open tab would see the
half.

**Leaving the page abandons it too, and that includes leaving for another
document.** A draft belongs to the file it was typed in: open another one and
the editor closes with the draft still unwritten, exactly as Cancel would.
That is worth saying out loud because the alternative is the quiet kind of
wrong — a draft that followed you to the next file could be saved onto it, and
where two documents happen to say the same thing (two empty notes, two copies
of one file) the conflict guard below would not even notice.

A save is ONE op at the same gate as everything else: validated, published on
its own revision (the other tab showing this document redraws on the frame it
lands), audit-trailed, and WAITING in the commit panel like any other write.
⌘Z takes a saved edit back, by the same rule as a retyped title: the inverse
carries the text it expects to find, so it can only take back what this tab
wrote.

**The file can move underneath you, and nothing is clobbered either way.**
Edit the same document in vim while the editor is open and the editor says so
the moment the disk moves; a Save after that is refused, in the ops layer's
own words, with your text kept exactly where you typed it. The refusal has
two doors out and both are yours: take what you need and Cancel, or press
**Overwrite what is there**, which is the same write minus the guard and
means exactly what it says. An agent gets the identical story — its
`write_document` takes a `was`, and the refusal is the same sentence.

**Two ways to a document that does not exist.** The sidebar's **+ New
document** asks for a path — relative, `.md`, judged by the same rules an
agent's `create_document` is judged by — and a **bare calendar day** (no
node, no note) mints that day's note, filed where your vault already keeps
them: the convention is read off the newest existing daily note's own path
(`Daily/2026/08/2026-08-12.md` puts September's first note at
`Daily/2026/09/2026-09-01.md`), never configured. Either door lands in the
new document's editor, and the sidebar lists the file on the same frame.
