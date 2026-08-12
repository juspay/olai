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
is `Archive.jsonl`, keeping its id, which is what archiving does to anything: a
trash rather than a shredder, refused outright once anything has been filed
under it, and not something a key of its own can ask for.

Deliberately absent, each its own item: delete, split and merge, multi-select,
and drag-and-drop.
