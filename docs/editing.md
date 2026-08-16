# Editing: the keyboard, and the pointer

Click a title and the caret is in it. From there it is the outliner's loop on the keys you already know, and the whole list is in the app, under **Keyboard shortcuts** in the ⌘K palette.

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

Nothing has a mode: the title becomes an input in the same place, at the same size, and the row you are in is toned so you can see where the caret went. What you type is the SOURCE — `**bold**` and `#tags` as they are written — and the rendering comes back the moment you leave. A note is the same trade one line down.

**What has no key is in the row's `•••` menu**, and it has two doors. On a pointer device, hover a row and the `•••` appears in the gutter left of the collapse triangle. A phone has no hover and no room for it, so there the door is the row itself: **hold a finger on a row** and the same menu opens under it, with the same verbs. Nothing in it is a mouse's alone. A finger that MOVES is scrolling the page, not pressing — the menu comes up only for one that stays put — and the tap that lifting it would otherwise leave behind is dropped, so a press never also opens the row for editing or follows its bullet.

## The three marks, from the keyboard

There are three marks and a node carries at most one of them ([format.md](format.md)) — so there are two keys, and between them they write all three and take one off.

**⌘Enter finishes something**, and takes that back. It is the mark with an instant on it: a `done` says when, which is what puts the work on that day's page.

**⌘⇧Enter walks the mark on** — one step round the answers a person gives about work they have NOT finished: a bullet, then `todo`, then `doing`, then a bullet again. That last stop is an answer rather than a gap. A node carrying no mark is not an unfinished one, it is a bullet, and the page draws it with no box at all; walking to it is how you say a row was never a task, or has stopped being one.

`done` is deliberately not a stop on that ring. Finishing something is a thing you mean, not a thing to do on the way past, so nothing stamps a completion while you are walking round.

**And the walk will not take finished work backwards.** Press it on a row that is done and the write is refused, in the same words an agent gets: *nothing should decide on your behalf that finished work is not finished*. The way through is the sentence's own — ⌘Enter takes the `done` off, and the walk carries on from the bullet that leaves. Two presses, the second one yours; the ••• menu asks the same two clicks for the mouse, and an agent makes the same two calls.

**And it will not start what the order forbids.** A row that comes after work nobody has finished cannot take the `doing` step — the app has drawn that row dim since edges-ui, and now the write says so too, naming what is in the way and the mark each blocker carries. The way through is the sentence's own again: finish those, or start something that is ready. Only the STARTING step is gated — ⌘Enter still ticks a blocked row off, because finishing out of order is sometimes simply what happened — and the ••• menu, the ⌘K palette and an agent's `set_doing` all meet the identical sentence, because there is one gate and every face sends one op through it. A ⌘Z that would put a `doing` back on a row something has since got in front of is refused there too: an undo is a write, judged against the outline as it is now.

Every one of these is a fact about the node a row SHOWS, so pressing either key at a mirror marks the node it stands for, and every placement of it follows.

A key is not a change to the page. Every one of them is one operation through the same gate the agent writes through, so a row moves when the file says it moved and two tabs on the same outline cannot disagree. What you type buffers locally until you stop (blur, Enter, or a pause), so typing is never a round trip; that buffer is an editor and not a claim about the file, and a write that comes back refused — a title cannot be empty — puts the reason under the row and leaves your text exactly where it is.

A new row is that same idea: **Enter** opens a line where the row will go, and the node is written the moment it has a title. So an outline never fills up with blank bullets, and a key pressed by accident writes nothing at all. A line like that is a line like any other while you are in it: click somewhere else and it is written and left behind, with the caret where you clicked rather than back in the row it just made.

## One row into two, and two into one

**Enter in the MIDDLE of a line cuts it there.** What is before the caret stays where you were; what is after it becomes the next row, and the caret goes with it, at its head — those are the words that moved. Everything that DESCRIBED the row you were in stays with it: what hangs under it, its note, its mark, its date, what it waits on. The line that came off is a new row, and a new row is a bullet — nobody has said anything about it yet, and this app does not decide that for you.

At the END of a line the key is what it always was, because there is nothing after the caret to split off. At the HEAD of one it is that too, and that is a decision worth saying out loud: an outliner you have used would put a blank row above, and here there is no blank row to put — a node needs a title ([format.md](format.md)) — so nothing is written that the write gate would have to refuse. Cutting where one side would be nothing but spaces is the same thing for the same reason, and reads the same way.

**Backspace at the START of a line joins it onto the row above** — its sibling, the row your eye is on. The two titles run together with nothing between them, because that is what they were before somebody cut them; the caret lands on the seam. Anywhere else in the line, Backspace is the ordinary one and deletes a character; it means this only in the one place it has nothing of its own to do.

What happens to the rest of the row is the whole of the semantics, and there are no silent losses in it:

- **what hung under it is adopted** by the row above, in order, at the end of what was already there. Nothing is orphaned by a keystroke.
- **the notes join**, one blank line apart, and a row with no note simply takes the other's.
- **its mark, its date, the document on it and what it waits on go with its record to the Trash.** A node carries at most one of each and the surviving row already has its own answer, so there is nothing to merge — and the record is not destroyed: it is in the Trash with its id, and **Put back** returns it. What you get instead of silence is a line under the row saying what went, because a `done` leaving the outline is exactly the thing nobody should have to notice for themselves.

The first row of a level has nothing above it to join, and a row above that is a mirror has no title of its own to join onto; both say so under the row, in the ops layer's own words. **Neither key works at a mirror**, and that is the same sentence read once more: a mirror is a second placement of a node that lives somewhere else, so cutting one in two would put the half that came off beside that node, in a file you do not have open — the two halves of your sentence would stop being neighbours. Both refuse there, naming the node to go to.

**A line you have only just started counts.** Neither key needs the row to have been saved: what you typed is written first, exactly as walking away from it would have written it, and then it is cut or joined. So `Enter`, a few words, `Home`, `Backspace` puts them on the line above — which is what that gesture means everywhere else.

**⌘Z takes either back.** The undo of a split is the merge that puts the two halves back together; the undo of a merge is longer and does the whole thing — the record out of the Trash, back where it sat, its children back under it, and the joined title cut back to what it said. Judged against the outline as it is now, like every other undo below, so an undo that no longer fits says so rather than guessing.

Both keys are ONE write at the same gate everything else goes through, and an agent has them too — `split_node` and `merge_node` are the same two ops. That matters more here than anywhere else on this page: a merge moves four rows and puts a record away, and it either happens whole or does not happen.

## Three characters that open something

While the caret is in a title, three things you type put a short list under the line. Walk it with **↑** / **↓**, take one with **Enter**, put it away with **Escape** and keep typing.

| | |
|---|---|
| **!** | a day, in words — `tomorrow`, `next fri`, `aug 20`, `in 3 weeks`, `2026-09-01` |
| **#** / **@** | a tag this set already uses |
| **((** | search the set for a node, and place a second copy of it here |

Nothing here is a mode. What is open is decided by the text and where the caret is in it, so backspacing over the `!` shuts the list and typing it again opens the same one — and a trigger that matches nothing shows nothing at all, which also means **Escape** and the arrows go on meaning what they always meant. `#` and `@` need a word boundary in front of them, so `srid@srid.ca` is an address rather than a tag.

**`!` writes the node's date, not text.** The list says the DAY beside every phrase — `next friday` is an argument about which Friday, and nobody should have to press Enter to find out — and taking one sends the same `date` edit the pill's picker and an agent's `set_date` send. The `!next fri` you typed comes back out of the line before it is committed; on a row you have only just started, the line is written first and then dated, which is the order every structural key follows.

**`#` and `@` are two namespaces, and both are real.** A tag lives inline in a title ([format.md](format.md)), so choosing one just writes it into the line you are typing and it commits with the rest of it — no separate write. The list is every tag written in the outlines this tab has loaded, most-used first, and the sigil you typed is the one you get: `#alice` and `@alice` are different tags. Nothing is added after the tag — not even a space — because a title is stored verbatim and a character you did not type is a character in your git history.

**`((` places a mirror.** The search is the server's own, the same one ⌘K and the header box use, so what this finds and what an agent's `search_nodes` finds cannot drift; each row says where that node sits. Choosing one sends `add_mirror`. WHERE it lands is the line you were on: a line you had only just opened and typed nothing else into BECOMES the placement, which is the gesture you know — Enter, `((`, choose — and a line with words in it keeps them, with the placement as the next row. A mirror is a whole row in this format (`{id, parent, ord, mirror}`, no text of its own), so it cannot sit inside a sentence; beside the sentence is the honest reading of the same gesture. ⌘Z retires the placement it made.

## Dragging a row

**Drag a bullet and the row goes with everything under it.** The bullet is the handle, the way it is in Workflowy — press it and travel, and a line appears where the row would land. Press it without travelling and it is still the link it always was, into that node's own page.

That line answers two questions at once, because the gesture asks two: **which gap** it sits in, and **how far in** it starts. Those are different placements that look the same on screen — the last child of the branch above and the next sibling of that branch's parent sit on the same line — so the line moves sideways as you do, and where it starts is the depth you are asking for. Let go and that is where the row is.

**A branch is never offered a place inside itself.** The rows being carried are simply not among the ones a drop can land beside, so there is no gesture that asks for a loop.

What a drop sends is one op per row moved — the same `move_node` an agent would send, naming a parent and the sibling to sit after — so a drop is refused, and says why, exactly as a `Tab` is. ⌘Z takes one back like any other edit.

**Hold a row near the top or bottom of the window and the page comes to you.** An outline is longer than a screen nearly always, so a drag that could only reach what happened to be visible when you pressed would be most of the gesture missing. The nearer the edge, the faster it moves; move away and it stops. The line that says where the row would land is re-read as the page goes, so it is always about where the pointer is *on the page*.

**With a finger, hold the bullet first.** Press it, wait for the row to lift, and then it follows your thumb — the same drop line, the same landing. Until that moment nothing is claimed: a finger that moves before the row lifts is scrolling the page, exactly as it always was, and that is true whether it started on a bullet or anywhere else. The bullet is the handle on every device, which is why holding a finger *there* no longer opens the row's ••• menu — holding the row anywhere else still does.

## Picking several rows

Everything above works on more than one row at a time. All five of Workflowy's ways to pick them:

| | |
|---|---|
| **⌘-click** / **Ctrl-click** a title | add a row to the pick, or take it out |
| **Shift-click** a title | pick everything between |
| **Shift+↑ / Shift+↓** from a caret | leave the caret and start picking |
| **⌘A / Ctrl+A** twice in a row | the line, then the row and the ones beside it — and again to widen to the page |
| **Drag across the rows** | pick everything the pull passes over |

**Where a pull begins is what decides whether it is a sweep or a text selection**, and that is the whole rule. Press *on the words* — a title, a note — and it is the browser's own gesture, unchanged: sweep a line and quote it, across as many rows as you like. Press on the outline's own empty space and there is nothing there for the press to be about except the rows themselves, so it picks them. That empty space is the **rail down the left of the outline** (beside every row, however far in it is drawn), the strip left of a note, the gaps between rows, and the page below the last one. A band follows the pull and spans the rows' full width, because a row is a *line*: which rows a sweep crosses is a question about how far down it went, never about how far in they are drawn.

What is *not* empty space is a row's own gutter, even before its controls fade in: the collapse triangle and the ••• live there, and a press in that column is theirs. Pressing one of the sweep's own surfaces without pulling puts the pick away; pressing a control does not, because it is aimed at the row rather than at nothing — and anything that puts a caret in a row puts the pick away by itself.

A sweep leaves the two ends every other picking gesture leaves, so a Shift-click or a Shift+arrow after one carries on from where the pull started. It replaces the pick rather than adding to it, and it is a pointer gesture: on a phone, a finger on empty space is scrolling.

A pick and a caret are never both live: picking rows puts the caret away, and putting a caret anywhere — a title, a note, a new line — puts the pick away. That is what lets the keys stay the keys you already know: over a pick they mean the same thing, several times.

| | |
|---|---|
| **Tab** / **Shift+Tab** | indent them, or take them out again |
| **Alt+Shift+↑/↓** | move them among their siblings |
| **⌘Enter** / **Ctrl+Enter** | tick them off, or take that back |
| **Drag any of their bullets** | move all of them, subtrees and all |
| **Escape** | put the pick away |

A sweep held near the bottom of the window scrolls the page too, the same way a drag does.

**A parent and a child in the same pick are one row to a verb.** A subtree moves whole, so the child is already coming along; asking again would be asking about a row that has already gone.

**And a bulk gesture is several writes, not one.** It is the op the single-row key sends, once per row, in the order that produces the shape you asked for — which is exactly what the agent does when you tell it to indent three things, and is why nothing here can do something the agent cannot. One that is refused stops the run and says why, in the ops layer's own words, on the bar at the foot of the page; what already landed stays landed.

**Move to Trash** is on that bar, and it is the one bulk verb with no key — because there is still no delete key in this app, and a chord that takes several branches away would be that decision at its worst. It asks first, naming how many rows go, and it is the same put-away the ••• menu's own entry is: the ids come along, the Trash in the sidebar is where they are, and **Put back** is there. A pick holding a *placement* is not offered it at all: the node a mirror shows lives in another file, and the bar says so rather than quietly doing the rest.

## Putting a node on a day

A node's `date` is what it is scheduled for ([format.md](format.md)), and it is the one thing an agent could change that a person could not — so it has a picker, in place under the row, and two ways to open one.

**A dated row's own pill is the control.** Press the date beside the title and the picker opens on it. A row with no date has no pill to press, so its way in is the ••• menu: **Set date…** on a row with none, **Change date…** on one that has one. From the keyboard it is `!` and a day in words (above), which sends the same edit.

What you get is your browser's own date picker, and what is written is the day you picked, exactly as it is written — `2026-09-01`, ten characters, never a timestamp this app invented on the way. **Enter** sets it, **Escape** and **Cancel** leave without writing, and ⌘Z takes a pick back like any other edit. Empty the box and the button becomes **Clear date**, which is the ••• menu's own verb and the same write: one way to say "no date", whichever door you came through.

A node scheduled for a time of day rather than a bare day keeps whatever it says on disk until you pick — the box shows the day that time falls on, and the panel says what picking one would replace, because a picker picks days.

The row moves the moment the file says so: a task given a day that has gone is in Overdue on the agenda and on that day's page, without a reload and without this page deciding anything for itself.

## What a node says about itself

A node's **properties** are named facts on it ([format.md](format.md)) — `pr`, `agent`, `isbn`, whatever a reader wants to be able to ask about later. They live in the record's one open field, `custom`, and they are drawn in a quiet drawer under the node's note, one `key value` line each.

**The drawer leads with the facts the node already carries**, read-only: its `id`, the mark it has, its `date`, and the `created`/`changed` stamps when it has them. Those had nowhere on the page to be read at all — the id in particular is what every tool call and every `((` reference takes. Below them are the custom keys, and those are the writable ones.

**On a row it appears once somebody has added a property**; on a node's own page it is always drawn. A tree is a column of titles, and an `id` line under every bullet in the vault would double the height of every row to say something nobody asked to see.

**The `•••` menu writes the custom half.** *Add property…* opens two boxes under the row — a key and a value — and every custom property already on the node adds a pair beside it: *Edit `pr`…*, which opens the same panel with the value in it, and *Remove `pr`*, which is one write and takes the key off. **Enter** sends, **Escape** and **Cancel** leave without writing, and ⌘Z takes it back. What goes is the same `set_prop` an agent sends, judged by the same planner and refused in the same words — including its refusals: setting a property to the value it already holds, or removing one that is not there, is turned away rather than written, so the same gesture twice is one write and one sentence.

**One removal has no undo, and says so by having none**: a property whose value is a LIST, which only a hand-edited file can hold. `set_prop` writes text, so an undo would have to flatten the list into one string with commas in it; nothing is recorded instead, and ⌘Z walks past to the write before.

**The key is fixed while you are changing a value**, and that is not a limitation of the boxes: `set_prop` writes one key, so renaming a property is removing one and adding another — two ops, which is exactly the two calls an agent makes. Both entries are in the menu.

**The node's own facts have no entries.** Each of them already has a verb — the mark section, *Change date…*, the two edge verbs — and `set_prop` refuses every one of them by name, so an entry would be an affordance that leads to a refusal.

**A zoomed node draws its drawer and has no door to it**, which is the gap *Set date…* has on the same page and for the same reason: the `•••` hangs off a row, and the ⌘K palette can only carry the verbs that need no second gesture. *Remove `pr`* is one of those, so the palette has it; adding and editing are reached from the row.

## What a node points at

A node carries two lists of other nodes ([format.md](format.md)): `see`, which is a link and nothing more, and `after`, which is what it must come after. The page has drawn both for a long time — the links under a node, and, for a blocked row, the dim, the mark column's glyph and the **blocked by** line on its own page. Both can be written now, from either end.

**The `•••` menu has the two verbs**: *Link to a node…* and *Wait for a node…*. Each opens a panel under the row holding what the node says now, with an `×` on each of them, and a box that searches the whole directory — the server's own search, the same one ⌘K, the header box and `((` use, so what this finds and what an agent's `search_nodes` finds cannot drift. Walk the hits with the arrows, take one with **Enter**, leave with **Escape** or **Done**. Choosing one sends the same `set_see` / `set_after` an agent sends, and ⌘Z takes it back.

**A zoomed node has the same two**, as controls under its own lines, because a heading has no `•••` to hang them off — the gap the ⌘K palette's op rows close for the verbs that need no second gesture, and cannot close for the ones that open something (`Set date…` is the same case).

**A node's page draws the two lists apart, and only one of them is yours to change.** `after` is the field this node carries, so it has the `×`; **blocked by** is DERIVED — what is in the way *right now*, which is unfinished work only, and which may be a `blocks` written on somebody else's record. Those are different claims, and an `×` on the derived one would name no single edge.

**A loop is refused, in the ops layer's own words, naming the loop.** `after` is the ordering graph, so `a after b after a` is a set of tasks none of which could ever start; asking for one is answered with *`order` after `install` closes a loop — `order` → `install` → `order`* under the panel, which is the sentence an agent's `set_after` gets. Nothing is greyed out first: the entry is offered on every node and the reason arrives when it is asked for, which is the same rule the mark verbs keep for finished work. A `see` loop is refused by nothing, because two notes pointing at each other is a thing people write on purpose.

Both are facts about the node a row SHOWS, so choosing one at a mirror writes the node it stands for — a placement carries no edges of its own.

## Taking an edit back

**⌘Z takes back the last edit you made on this outline** — and it is not a restore. When a key moves a row, ticks something off, or commits what you retyped, the server records what would REVERSE it (the parent and neighbour the row had, the mark it replaced, the words it replaced) and ⌘Z sends that, through the same gate, judged against the outline as it is now.

Which is what makes it safe to share an outline. An undo cannot quietly take back what the agent, another tab or a `git pull` did in the meantime; one that no longer fits — the row moved, somebody filed work under it, somebody retyped the line — says so instead of guessing, in the words the write gate would use. It is your own edits, on the outline in front of you: a hundred of them, this session, this tab. Open another outline and it starts again.

While you are still typing, ⌘Z is the text box's own, exactly as it is anywhere else. The outline's undo starts once the line is committed, which is the moment it became something anybody else can see.

**There is no delete key.** What ⌘Z can take back is a row you have just made — the un-create, which is the inverse of the `Enter` that made it. Where it goes is the Trash, keeping its id, which is what putting anything away does: a trash rather than a shredder, refused outright once anything has been filed under it, and not something a key of its own can ask for.

## The Trash

The `•••` menu's **Move to Trash** puts a row and everything under it away, behind a question that names how many rows go. Where they go is `Archive.olai` on disk — an outline like any other to an agent, whose tool for the same gesture is still called `archive_node` — but to a person it is the **Trash** at the foot of the sidebar: every archive under the directory, readable and not editable, each subtree drawn under the chain of ancestor titles it hung off.

Not every row in there is a thing you put away. Above each pile sit the **titles the archive wrote down to remember where it hung** — so the tree still reads years later — and those are signposts rather than nodes: the ones they name never left. Pressing **Put back** on a signpost says so, and names the live row that still carries the title. What comes back is what went in.

**Put back** is the one verb a Trash row has, and it is the whole reason the Trash is a trash. It sends the same `unarchive` op an agent's `unarchive_node` sends — the op both faces got in the same change, because neither face may do what the other cannot — and the subtree returns where the recorded chain says it came from, last among its new siblings, children and ids intact. A chain that no longer stands (retitled, or put away itself) is a refusal in the ops layer's own words under the row, never a guess; an agent can name a destination outright, and restoring the chain first is the way through for the mouse. ⌘Z after a Move to Trash puts the row back too — the undo knows the exact parent it sat under — and ⌘Z after a Put back is the archive again.

Deliberately absent, and still the human’s to rule on: a delete key.

## From the ⌘K palette

The palette goes places and asks the agent ([search.md](search.md)); it writes two things as well, and both of them are the same op through the same gate as everything above.

**An untouched palette has nothing chosen.** The rows a node can take are listed first, where you can see them, and that is only safe because the highlight is where the arrows START rather than a choice you made: press ⌘K and Enter and nothing happens. The first character you type is the choice, and it lights the best match; ↓ is the other way in.

**The verbs of the node you have ZOOMED.** On `/n/<id>`, the palette lists what that node can take — `Mark todo`, `Complete`, `Clear mark`, `Clear date`, `Move to Trash` — the entries of the row's ••• menu that need no second gesture, decided by the same rule (a verb that would change nothing is not drawn), naming the same ids, and refused in the same words. Each row says which node it is about on its second line, because a palette is opened from anywhere. This is the affordance the zoomed node never had: the ••• hangs off a row, and a zoom is a page.

On any other page there are none of them. A command read out of context must not be aimed at a node you cannot see, and what the address says you are looking at is a fact you and the palette can both see.

**The three that ask something first stay where the asking happens** — `Set date…`, `Link to a node…` and `Wait for a node…`. Each opens a panel that hangs off a row, and a palette drawn over the page has nothing to open; a zoomed node reaches all three from its own controls instead (above). `Move to Trash` asks its question in the palette's own box, with the same sentence and the same count the menu asks. **The question takes the caret when it is raised** — so Enter answers it, Tab cycles its two ways out, and Escape or **Cancel** backs out. Nothing you type elsewhere becomes the answer.

**One write at a time.** The gate is a round trip, and a second Enter while the first is still out is two writes for one intention — so the second is ignored rather than sent, exactly as the date picker's button already worked.

A refusal, or a nudge from a write that landed, is drawn in the palette and the palette stays up: a modal that closed on top of the reason would be exactly the silent failure this app is written against. A write that landed with nothing to add closes it, which is what choosing a command means. Either way ⌘Z takes it back — one undo stack, whichever hand made the edit.

## Quick capture

**`⌘K`, `+`, the line, Enter** — and nothing moves. The page you were reading, your scroll and the address stay exactly where they were; the line becomes a node; the box empties for the next one, so several thoughts arriving at once cost one chord.

It lands at the top level of the directory's **inbox** — the outline called `Inbox.olai`, wherever the directory already keeps one, and a new `Inbox.olai` at the root when it has none. Minting it is part of the same single operation as the line, so a capture that is refused leaves no file behind. Which file that is is decided on the server, against the same reading the write is judged on, exactly as a daily note's path is.

The palette says so afterwards — a write whose whole point is that nothing on screen moves has to say it happened — and ⌘Z takes a capture back like any other write. An agent makes the same two moves by hand (read the outlines, then `add_node` or `create_outline`), so nothing here is a reach the tools do not have.

The **Capture to the Inbox** row in the palette is the same gesture for a reader who has not been told about the prefix: choosing it types the `+` and leaves the caret after it.

## Starting an outline

**The sidebar's `+ New outline`** asks for a path — relative, `.olai`, judged by the same rules an agent's `create_outline` is judged by — and mints the file there. What comes back for a path it will not take is that op's own sentence, under the box: one the directory already holds, one that climbs out of it with `..`, one whose name does not end in `.olai`. Enter creates it, Escape puts the box away, and the page it lands on is the new outline's, with the same *write the first line* the empty-outline page has always offered.

That first line is where this differs from the tool, deliberately. `create_outline` can be born holding a whole tree, which is what saves an agent a second call; a person types the row where it is going to live, so there is nothing here for a seed to be filled from. Nothing this door can reach is out of an agent's reach, which is the direction the consistency rule actually runs — and quick capture already sends a seeded create when the directory has no inbox.

**No door on either face removes a file.** An outline minted by mistake is an empty one in the sidebar, which is a thing you can see and delete yourself, rather than a file appearing and disappearing behind a chord — so ⌘Z after this one says nothing to take back, exactly as it does after a new document.

## Writing a document

A `.md` under the served directory has always had a page; the page can be written now. **Edit**, on its header, turns the rendered body into its SOURCE — a textarea holding the file verbatim, which is the same trade every title and note makes: what you type is the source, and the rendering comes back when you leave. There is no toolbar and no WYSIWYG, because a document is markdown and markdown is text. A `.html` in the directory has a page too and does not have that control: olai shows one and never writes one, and it is drawn — and runs — sealed in a sandboxed frame whose origin is nobody’s ([format.md](format.md#hypertext)).

The mode is declared, so leaving it is too — which is where a document differs from a note, and on purpose. A note is one line, entered by a click and committed on blur; a whole file written because a click strayed is a write nobody asked for. So **Save** commits (⌘Enter / Ctrl+Enter from the editor), **Cancel** abandons (Escape), and nothing commits on a timer — a document mid-edit is often half a sentence, and every open tab would see the half.

**Leaving the page abandons it too, and that includes leaving for another document.** A draft belongs to the file it was typed in: open another one and the editor closes with the draft still unwritten, exactly as Cancel would. That is worth saying out loud because the alternative is the quiet kind of wrong — a draft that followed you to the next file could be saved onto it, and where two documents happen to say the same thing (two empty notes, two copies of one file) the conflict guard below would not even notice.

A save is ONE op at the same gate as everything else: validated, published on its own revision (the other tab showing this document redraws on the frame it lands), audit-trailed, and WAITING in the commit panel like any other write. ⌘Z takes a saved edit back, by the same rule as a retyped title: the inverse carries the text it expects to find, so it can only take back what this tab wrote.

**The file can move underneath you, and nothing is clobbered either way.** Edit the same document in vim while the editor is open and the editor says so the moment the disk moves; a Save after that is refused, in the ops layer's own words, with your text kept exactly where you typed it. The refusal has two doors out and both are yours: take what you need and Cancel, or press **Overwrite what is there**, which is the same write minus the guard and means exactly what it says. An agent gets the identical story — its `write_document` takes a `was`, and the refusal is the same sentence.

**Two ways to a document that does not exist.** The sidebar's **+ New document** asks for a path — relative, `.md`, judged by the same rules an agent's `create_document` is judged by — and a **bare calendar day** (no node, no note) mints that day's note, filed where your vault already keeps them: the convention is read off the newest existing daily note's own path (`Daily/2026/08/2026-08-12.md` puts September's first note at `Daily/2026/09/2026-09-01.md`), never configured. Either door lands in the new document's editor, and the sidebar lists the file on the same frame.
