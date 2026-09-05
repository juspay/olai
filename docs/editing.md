# Editing: the keyboard, and the pointer

Click a title and the caret is where you clicked. From there it is the outliner's loop on the keys you already know, and the whole list is in the app, under **Keyboard shortcuts** in the ⌘K palette.

| | |
|---|---|
| **Enter** | commit, and open the next line |
| **Enter, at the start** | insert a blank line above |
| **Enter, mid-line** | split the row in two, there |
| **Backspace, at the start** | join this row onto the one above |
| **Tab** / **Shift+Tab** | indent under the row above, or out again |
| **Alt+Shift+↑/↓** (Mac: **⌘⇧↑/↓** too) | move a row among its siblings |
| **⌘.** / **Alt+.** | zoom into this row (⌘ on a Mac, Alt elsewhere) — the caret stays behind; a click opens a row again |
| **⌘,** / **Alt+,** | zoom out: to the page of the row's parent, or one zoom up — the caret stays behind, the same way |
| **Ctrl+Space** | fold this branch, or unfurl it |
| **⌘↑/↓** / **Ctrl+↑/↓** | fold this branch, or unfurl it — the one way you meant |
| **⌘Enter** / **Ctrl+Enter** | tick it off, or take that back |
| **⌥Enter** / **Alt+Enter** | call it off, or take that back |
| **⌘⇧Enter** / **Ctrl+⇧Enter** | walk the mark on: to do, then doing, then none |
| **⌘⇧D** / **Ctrl+⇧D** | duplicate the row, and everything under it |
| **⌘⇧M** / **Ctrl+⇧M** | move the row under a node you search for, anywhere in the set |
| **Shift+Enter** | write the note under it |
| **↑** / **↓** | walk to the row above or below |
| **Escape** | drop what you were typing |
| **⌘Z** / **Ctrl+Z** | take back your last edit on this outline |
| **⌘⇧Z** / **Ctrl+⇧Z** | put it back |
| **⌘⇧P** / **Ctrl+⇧P** | pin this page to the sidebar, or unpin it |
| **⌘O** / **Ctrl+O** | show this page's finished work, or hide it again |
| **Alt+click** | open a link in the pane to the right |
| **Alt+Shift+click** | open it in a new pane to the right |
| **Alt+←** / **Alt+→** | move focus to the neighbouring pane |
| **⌘⇧W** / **Ctrl+⇧W** | close the focused pane |

Nothing has a mode: the title becomes an input in the same place, at the same size, and the row you are in is toned so you can see where the caret went. What you type is the SOURCE — `**bold**` and `#tags` as they are written — and the rendering comes back the moment you leave. A note is the same trade one line down.

**What has no key is in the row's `•••` menu**, and it has two doors. On a pointer device, hover a row and the `•••` appears in the gutter left of the collapse triangle. A phone has no hover and no room for it, so there the door is the row itself: **hold a finger on a row** and the same menu opens under it, with the same verbs. Nothing in it is a mouse's alone. Tall menus scroll internally; when a menu opens upward, it reserves the app bar so its first entries remain visible. A finger that MOVES is scrolling the page, not pressing — the menu comes up only for one that stays put — and the tap that lifting it would otherwise leave behind is dropped, so a press never also opens the row for editing or follows its bullet.

## A row is its title

The reconnect dialog can take focus without committing or closing the row editor. A rebuild of the same page preserves the selected text range as well as the draft, so typing replaces the selected words and Enter splits around the same selection. Typing and arrow-key movement update that retained position too. Escape-dismissed input completions remain dismissed during the same draft’s rebuild; a fresh edit offers completions again. Clicking away still commits normally.

An outline is a column of titles, so that is what it draws — that, and the short facts a node carries, which are drawn as a run of chips under the title whether the row is open or not (*What a node says about itself*, below). What waits behind the small dim **¶** beside the title is the node's **note** and what it points at. Press the ¶ (or **Space**, with it focused) and the row opens: the title line says so, its tags brighten, and the note appears in full under the facts. Press it again, click away, or press **Escape**, and the row folds back. A node with nothing behind it wears no ¶ at all, so the mark is always a promise there is something there — and a node whose only body is properties has none, because the properties are already on the row.

**How much a row starts as is yours**, in *prefs → Notes*:

- **Compact** — the title and its facts alone.
- **Cozy** — those, and the first line of the note under them, clamped. This is the default, and the shape every row had before the compact switch existed.
- **Open** — every note you have not folded yourself is already open, in full.

It is a default and not a lock. The ¶ works at all three, and only rows you have not touched follow the setting — fold one at Open and it stays folded, open one at Compact and it stays open. Like every preference it belongs to this browser, reaches every tab of it, and is never sent anywhere: two machines reading the same vault are entitled to disagree about it, and it is one setting for the whole app rather than one per outline, because "I read a tree as a list of titles" is a fact about you and not about any one file.

**One fact may ride beside a title**, muted as a byline is: how far the tasks under a branch have got (`3/5`), or `pr` on work that has shipped.

**A collapsed branch may add one more** — how much finished work went with the fold, since done rows recede and a fold over them should leave a receipt rather than hide them twice. It appears only when the rollup has not already said it: on most branches `3/4` has counted those three, and `+3 done` beside it is the same number a second time. Where you do see it, it is because the rollup could not see that far — a rollup is about the row's own children, and finished work can sit deeper than that or arrive through a mirror.

**Top-level rows read as sections**: a heavier name, the rollup as part of that header, and they stay put under the app bar while their own branch scrolls past.

**The tags stay where they were written**, inline in the title, quieted by layout rather than by a box: no background, no border, brightening to the accent under the pointer and while the row is open. And each tag wears **a colour of its own**, read off its text: the hue is a stable hash of the tag as written, folded for case (`#Now` and `#now` are one tag, exactly as the search fold reads them) — so one tag is one hue on every face that draws a title (the tree, a breadcrumb, the palette, a day page), in light themes and dark alike, and two tags on one row separate at a glance. The alphabet does not colour: `#topic` and `@person` stay two namespaces shown by their sigil, while the hue separates the members inside either. The ink's lightness and chroma are each theme's, and every hue clears WCAG AA on every theme's page background by test — the colour never carries meaning the words do not. Pressing one still filters the page ([search.md](search.md)). Nodes' titles draw the same way wherever they appear — a tree row, a breadcrumb, a see-reference, a search or completion row, the move picker's heading, the commit panel, an outline diff the agent shows you — the pill and its hue come with them.

**And how big all of it is set is yours too**, in *prefs → Size*: Medium, Large or Larger. One number moves the whole page — rows, gutter, badges, panels — and it is a multiple of your browser's own text size rather than a pixel count overriding it. The default is Large, a notch above the browser's own: a column of titles read all day is not a document.

## The four marks, from the keyboard

There are four marks and a node carries at most one of them ([format.md](format.md)) — so there are three keys, all of them `Enter` with a modifier, and between them they write all four and take one off. `Enter` is the row's key; what you hold says which kind of change it is.

**⌘Enter finishes something**, and takes that back. It is a mark with an instant on it: a `done` says when, which is what puts the work on that day's page.

**⌥Enter calls something off**, and takes that back. The fourth mark, and the other one with an instant on it: `cancelled` says *this is not happening*, and says when you decided. Before it there was only one way to say that — walk the mark off and leave a bullet — and a bullet is a line nobody ever called work: no mark, no instant, no day. A month later you could not tell a thing you decided against from a note you jotted, and could not tell when.

A cancelled row is struck through, exactly as a finished one is, with a **crossed** box where a finished one has a check. The strike says the same thing about both — nobody is waiting on this line — and the box is where the two are told apart. It shows on that day's journal page like anything else that happened that day, labelled `cancelled`.

**Calling something off SETTLES it**, which is the half that changes other rows. Anything waiting on it stops waiting — the dim comes off, the hourglass goes back to a box — it stops being overdue and leaves what its day owes, and a parent above it can be ticked done, because a cancelled task is not one nobody finished. It also leaves a rollup's denominator: `3/5` counts what is happening, so calling one of five off makes it `3/4`.

**What it does not do is cascade.** Cancelling a parent says nothing about the rows under it: they keep their own marks, stay on the page, stay owed, and go on blocking. Nothing is refused and nothing is hidden — unlike ⌘Enter, which will not tick off a branch holding unfinished work, because ticking one off hides the whole subtree and calling one off hides nothing. What you get instead is a line under the row naming what is still standing, so you can call those off too if they are not happening either.

**⌘⇧Enter walks the mark on** — one step round the answers a person gives about work they have NOT settled: a bullet, then `todo`, then `doing`, then a bullet again. That last stop is an answer rather than a gap. A node carrying no mark is not an unfinished one, it is a bullet, and the page draws it with no box at all; walking to it is how you say a row was never a task, or has stopped being one.

Neither settling mark is a stop on that ring. Finishing something is a thing you mean, not a thing to do on the way past, and so is calling something off — nothing stamps an instant, or puts a row on a day's page, while you are walking round.

**And the walk will not take settled work backwards.** Press it on a row that is done and the write is refused, in the same words an agent gets: *nothing should decide on your behalf that finished work is not finished*. Press it on a cancelled one and the sentence is the same about work somebody called off — the instant it was called off at is on a day's page, and nothing overwrites one behind you. The way through is the sentence's own — ⌘Enter takes a `done` off, ⌥Enter takes a `cancelled` off, and the walk carries on from the bullet that leaves. Two presses, the second one yours; the ••• menu asks the same two clicks for the mouse, and an agent makes the same two calls.

**And it will not start what the order forbids.** A row that comes after work nobody has finished cannot take the `doing` step — the app has drawn that row dim since edges-ui, and now the write says so too, naming what is in the way and the mark each blocker carries. The way through is the sentence's own again: finish those, or start something that is ready. Only the STARTING step is gated — ⌘Enter still ticks a blocked row off, because finishing out of order is sometimes simply what happened — and the ••• menu, the ⌘K palette and an agent's `set_doing` all meet the identical sentence, because there is one gate and every face sends one op through it. A ⌘Z that would put a `doing` back on a row something has since got in front of is refused there too: an undo is a write, judged against the outline as it is now.

**And ⌘Enter will not tick off a branch that still holds unfinished work.** Hiding what is done takes the whole subtree with the row — that is what a mark on a parent claims — so a `done` written over a `todo` three rows down is that work off the page. The write is refused, naming the tasks with their marks, and the way through is either of the two the sentence offers: finish them, or call them off with ⌥Enter, since a cancelled task has settled and stands in nobody's way. (Walking their marks off says it too — a bullet is not unfinished work — and the difference is that a cancelled row keeps a mark, an instant and a day.) Bullets under the row never stand in the way; nor does anything a mirror draws, because a placement is a second view of a node and not a second obligation.

**And the walk RE-OPENS what stood over the work you just filed.** The other direction of the same rule, and only for the two marks that are work you still owe: marking a row `todo` or `doing` under a branch somebody ticked off last week takes the `done` off that branch — every one in the chain — rather than refusing you. The row you were writing is the newer fact, and a person writing work down should not be told no because of a mark they cannot see from where they are standing. It is never quiet: the branch's checkbox empties in front of you, the said line under the row names what it re-opened, and so does the commit. The same happens to a row you drag under a finished branch, to a capture that lands one there, and to work brought back out of the Trash. Calling a row off is NOT one of them: nothing arrived that anybody still owes, so a finished branch above it stays finished.

Every one of these is a fact about the node a row SHOWS, so pressing any of the three keys at a mirror marks the node it stands for, and every placement of it follows.

A key is not a change to the page. Every one of them is one operation through the same gate the agent writes through, so a row moves when the file says it moved and two tabs on the same outline cannot disagree. What you type buffers locally until you stop (blur, Enter, or a pause), so typing is never a round trip; that buffer is an editor and not a claim about the file, and a write that comes back refused — a title cannot be empty — puts the reason under the row and leaves your text exactly where it is.

A new row is that same idea: **Enter** opens a line where the row will go, and the node is written the moment it has a title. So an outline never fills up with blank records on disk, and a key pressed by accident writes nothing at all. Several empty drafts can stand on the page at once — **Enter Enter Enter** lays out a skeleton — and they stay until they have a title, until **Escape** drops the one you are in, or until the page closes. Click a parked one and the caret is back in it. A line like that is a line like any other while you are in it: type a title and leave, and it is written and left behind, with the caret where you clicked rather than back in the row it just made.

**A blank takes the shape keys too, before it is anything on disk.** **Tab**, **Shift+Tab** and **Alt+Shift+↑/↓** move the line you are typing on the way they move a row — one level in, one level out, one slot over — and nothing is written by any of them: the sketch is re-seated on the page, and the ONE write it eventually makes holds the shape you arrived at. So a skeleton can be shaped before a word of it exists. **Tab** into a branch that is folded opens the branch, because a line you cannot see is not a line you meant to write into. **Backspace** on an empty one deletes it and puts the caret at the end of the line above — the abandon that leaves you somewhere, where **Escape** is the one that just drops it.

The arrows and the shape keys read the page slightly differently, and it is the one place they do: **↑/↓** stop on every blank, because a blank is a line your eye lands on, while the shape keys step past a parked blank to the nearest real row. What a shape key answers with is a place in the file — *after this node*, *under that one* — and there is no way to say "between two lines that are not written yet".

## One row into two, and two into one

**Enter in the MIDDLE of a line cuts it there.** What is before the caret stays where you were; what is after it becomes the next row, and the caret goes with it, at its head — those are the words that moved. Everything that DESCRIBED the row you were in stays with it: what hangs under it, its note, its mark, its date, what it waits on. The line that came off is a new row, and a new row is a bullet — nobody has said anything about it yet, and this app does not decide that for you.

Typing into a parked blank while the previous row is still saving keeps those characters with the clicked blank. They enter its draft when activation finishes, without changing the row whose save is pending.

An unrelated plugin change keeps the outline's unfinished rows and any refused edit on the page. They can still be filled in, corrected or discarded after the rebuild. Each pane keeps its own drafts, including phone tabs showing the same outline and inactive tabs while a neighbour navigates; leaving for another page discards that page's parked rows.

At the END of a line the key is what it always was, because there is nothing after the caret to split off: a draft after this row, after the whole subtree. At the HEAD of one it inserts a blank draft *above*, and the words you were on stay where they were. That draft is still local — a node needs a title ([format.md](format.md)), so nothing is written until it has one. Cutting where one side would be nothing but spaces is the same thing as an end-of-line press, and reads the same way.

**Backspace at the START of a line joins it onto the row above** — its sibling, or its PARENT when it is the first of its siblings: the row your eye is on either way. The two titles run together with nothing between them, because that is what they were before somebody cut them; the caret lands on the seam. Anywhere else in the line, Backspace is the ordinary one and deletes a character; it means this only in the one place it has nothing of its own to do.

What happens to the rest of the row is the whole of the semantics, and there are no silent losses in it:

- **what hung under it is adopted** by the row above, in order, at the end of what was already there. Nothing is orphaned by a keystroke.
- **the notes join**, one blank line apart, and a row with no note simply takes the other's.
- **its mark, its date, the document on it and what it waits on go with its record to the Trash.** A node carries at most one of each and the surviving row already has its own answer, so there is nothing to merge — and the record is not destroyed: it is in the Trash with its id, and **Put back** returns it. What you get instead of silence is a line under the row saying what went, because a `done` leaving the outline is exactly the thing nobody should have to notice for themselves. Since the Trash is the one page that draws what is in it, that date leaves the day it was on and the calendar's dot with it — a merge is the second door into the rule the Trash section below states, and **Put back** is the way back through both.

The first row of a level has nothing above it to join, and a row above that is a mirror has no title of its own to join onto; both say so under the row, in the ops layer's own words. **Neither key works at a mirror**, and that is the same sentence read once more: a mirror is a second placement of a node that lives somewhere else, so cutting one in two would put the half that came off beside that node, in a file you do not have open — the two halves of your sentence would stop being neighbours. Both refuse there, naming the node to go to.

**A line you have only just started counts.** Neither key needs the row to have been saved: what you typed is written first, exactly as walking away from it would have written it, and then it is cut or joined. So `Enter`, a few words, `Home`, `Backspace` puts them on the line above — which is what that gesture means everywhere else.

**⌘Z takes either back.** The undo of a split is the merge that puts the two halves back together; the undo of a merge is longer and does the whole thing — the record out of the Trash, back where it sat, its children back under it, and the joined title cut back to what it said. Judged against the outline as it is now, like every other undo below, so an undo that no longer fits says so rather than guessing.

Both keys are ONE write at the same gate everything else goes through, and an agent has them too — `split_node` and `merge_node` are the same two ops. That matters more here than anywhere else on this page: a merge moves four rows and puts a record away, and it either happens whole or does not happen.

## Copying a branch

**⌘⇧D copies the row you are in and everything under it**, as the sibling immediately below. The same verb is `Duplicate` in the row's `•••` menu and in the ⌘K palette on a zoomed node, and `duplicate_node` for an agent — one op, one write, whichever hand asks. It is what a template is for: write the shape once, and take a copy of it every time you need it again.

**The copy is a second THING, not a second view of the first.** Every id in it is new — the row's, and every row under it, however deep — so writing to the copy leaves the original exactly as it was. That is the whole promise, and it is what makes this different from the `((` placement one section up: a mirror is one node in two places, and a duplicate is two nodes.

**Everything else comes across as it was written, the marks included.** A `done` keeps the instant it was stamped at, so the copy is on that day's page too; a `todo` is still a `todo`; the date, the repeat rule, the note, the properties and the document a row names all come with it. Nothing is re-stamped and nothing is cleared, because each of those would put a claim on the copy that nobody made — that it was never a task, that you finished it today, that you have not started it. The two fields that ARE the copy's own are the ones nobody writes on purpose: it was created just now, and nothing has changed it since. The title is copied verbatim too — no `(copy)`, no `#copy` tag — because a title is stored exactly as it was typed and a word nobody typed is a word in somebody's history.

**What the copy points at follows one rule with two halves.** A reference the branch made to ITSELF is re-aimed at the copy: a row that waited on its own sibling waits on the copy of that sibling, a `see` between two rows inside it links the two copies, and a mirror placed under it is copied as a mirror in the same place. A reference that LEFT the branch keeps its target, because that target was not copied and there is nothing else it could mean — so a copied row that waited on something outside still waits on the same thing. The copy is therefore a working copy of the shape rather than a tangle of half-references back into the original.

**What points AT the branch does not follow it.** A row somewhere else that linked to something inside what you copied still links to that same thing — the original — because that row was not copied and nothing you did was about it. So duplicating never quietly re-aims somebody else's reference, and never doubles it.

**A mirror is copied as a placement**, never as a twin: the copied line still shows the node it always showed, wherever that lives, so duplicating a Now list gives you a second list of the same work rather than a second copy of the work.

**There is no Duplicate on a placement.** A mirror's own verb is `Remove this placement`: copying through one would write a branch into the file its target lives in, out of sight of the line you clicked. Ask for it on the node itself.

**⌘Z takes the copy to the Trash**, keeping its ids, and ⌘⇧Z brings it back — the same way back every removal in this app has.

## Moving a row somewhere else entirely

An open Move picker retains its row and typed destination search when plugins rebuild the same page. Cancelling and opening another move starts with an empty search; navigating away discards the prepared move.

**The caret keeps its place through all of them.** A row moves when the file says it moved, which in a browser means the line you are typing in is drawn again somewhere else — so the app puts the caret back at the character you were at, rather than at the end of the line. **Tab** in the middle of a word leaves you in the middle of that word.

Every key above moves a row one step from where it is: **Tab** goes under the row above, **Shift+Tab** up a level, **Alt+Shift+↑/↓** among its siblings, and a drag reaches as far as you can carry it. None of them can say *this belongs under that node, three hundred rows down* — which is the move you actually mean once a branch has ended up in the wrong place.

**⌘⇧M opens a picker on the row you are in.** Type, and it searches every node in the directory; **Enter** puts the row — and everything under it — under the one you chose. It is the same search ⌘K and the header box use, so what it finds and what an agent's `search_nodes` finds cannot differ, and each row says where that node sits. The same verb is **Move to…** in the row's `•••` menu, which is the door a phone has. What lands is one `move_node`, the op an agent sends.

**The node you chose may be in another outline, and then the row goes there.** It searches the whole directory, so it finds them; picking one carries the row and everything under it into that file, **keeping every id**. Nothing that pointed at what moved comes loose: a mirror drawn somewhere else still draws it, a `see` still opens it, an `after` still waits on it, and a link written in a note still lands on it. That is the same promise **Put in Trash** has always made about the same journey, and it is why this is a move rather than a copy — writing the branch out again in the other file and deleting the old one would give it new ids and quietly break all four.

**The row goes LAST among its new siblings.** Where among them is not part of what you asked: you named a parent, and "last" is what this app means by putting something under a node — the same place **Tab** leaves an indented row. Move it up from there with the arrows if it belongs higher.

**The picker shows everything it finds, including where the row cannot go — and says why.** The reason appears as you walk onto a row, before you press Enter, and pressing Enter there writes nothing. There are three of them:

- **Somewhere this row already draws.** A branch cannot go under its own child, or under itself. It also cannot go under anything a mirror INSIDE it shows: a Now list made of mirrors draws the work those mirrors point at, so putting Now under one of the items it is showing would draw the page inside itself for ever. That one names the chain, because the destination can be branches away on screen and nothing else would explain it — and it is the same sentence read backwards for a mirror ROW, which cannot go under what it shows. An agent's `move_node` refuses all of it in the same words.
- **The Trash.** Work that has been put away is not somewhere to move work to; **Put back** is how something comes out. Archived nodes are out of the search's answer anyway unless you ask for them with `is:trashed`, so this is the sentence for when you did.
- **The parent it already has.** It is in the list — you should be able to find a title you can see — and it is refused, because a destination puts the row *last* under it, which would silently reorder rather than move. Reordering has two gestures of its own that say so: **Alt+Shift+↑/↓**, and dragging.

**And Enter takes a row of the list you are looking at.** The search is the server's, so it settles for a fifth of a second before it asks and the rows in front of you hold still until the next ones land — which is the right thing to draw and the wrong thing to write from. Enter inside that gap writes nothing rather than taking the row the query before last found; the rows catch up a moment later, and the same key takes the one you meant. Nothing dims while it waits, and a CLICK is never held back — your hand is on the row you can see, and that is the row it takes. Every list in this app that a key takes a row out of answers it the same way, for the same reason: the three a title opens (below), the edge panel, the `⌘K` palette and the header box ([search.md](search.md)), and the `@` list in a message to the agent ([chat.md](chat.md)).

**Nothing is echoed, and ⌘Z takes it back.** The row appears in its new home when the file says so; if the move re-opened a finished branch on the way in (the rule two sections up), the sentence saying which is drawn under the row *where it landed*. ⌘Z puts it back where it sat — the parent and the neighbour it left, not merely the parent.

## Three characters that open something

While the caret is in a title, three things you type put a short list under the line. Walk it with **↑** / **↓**, take one with **Enter**, put it away with **Escape** and keep typing.

| | |
|---|---|
| **!** | a day, in words — `tomorrow`, `next fri`, `aug 20`, `in 3 weeks`, `2026-09-01` |
| **#** / **@** | a tag this set already uses |
| **((** | search the set for a node, and place a second copy of it here |

Nothing here is a mode. What is open is decided by the text and where the caret is in it, so backspacing over the `!` shuts the list and typing it again opens the same one — and a trigger that matches nothing shows nothing at all, which also means **Escape** and the arrows go on meaning what they always meant. `#` and `@` need a word boundary in front of them, so `srid@srid.ca` is an address rather than a tag.

**`!` writes the node's date, not text.** The list says the DAY beside every phrase — `next friday` is an argument about which Friday, and nobody should have to press Enter to find out — and taking one sends the same `date` edit the pill's picker and an agent's `set_date` send. The `!next fri` you typed comes back out of the line before it is committed; on a row you have only just started, the line is written first and then dated, which is the order every structural key follows.

**`#` and `@` are two namespaces, and both are real.** A tag lives inline in a title ([format.md](format.md)), so choosing one just writes it into the line you are typing and it commits with the rest of it — no separate write. The list follows the tags currently written anywhere in this vault, most-used first. An open prefix updates when another writer adds, replaces or removes a tag, including when the last match disappears and a later write brings a match back. The typed draft stays intact, and the sigil you typed is the one you get: `#alice` and `@alice` are different tags. Nothing is added after the tag — not even a space — because a title is stored verbatim and a character you did not type is a character in your git history.

**`((` places a mirror.** The search is the server's own, the same one ⌘K and the header box use, so what this finds and what an agent's `search_nodes` finds cannot drift; each row says where that node sits. Choosing one sends `add_mirror`. WHERE it lands is the line you were on: a line you had only just opened and typed nothing else into BECOMES the placement, which is the gesture you know — Enter, `((`, choose — and a line with words in it keeps them, with the placement as the next row. A mirror is a whole row in this format (`{id, parent, ord, mirror}`, no text of its own), so it cannot sit inside a sentence; beside the sentence is the honest reading of the same gesture. ⌘Z retires the placement it made.

**A placement is retired from its own row.** The ••• menu on a mirror offers **Remove this placement**, and it is the one write in that menu about the row's OWN record rather than about the node it draws: the line goes, and the node keeps its title, its mark, its children, its place in the outline that defines it, and every other placement of it. Which is why a mirror row is offered this and never *Move to Trash* — putting a subtree away from a line standing for it would file work that lives in a file you are not looking at, on a click that reads as being about this line. What goes is the same `remove_mirror` an agent sends, and it is refused in the same words while anything still names the placement — another mirror chained onto it, an edge written at it — naming what to re-point first. **It is also the one edit here ⌘Z cannot take back**, and it says so by recording nothing rather than by leaving an undo that would put a different line somewhere near: taking it back would mean minting that placement's own id again and naming the slot it sat in, and neither is something this editor can say. `((` is how it comes back.

## Dragging a row

**Drag a bullet and the row goes with everything under it.** The bullet is the handle, the way it is in Workflowy — press it and travel, and a line appears where the row would land. Press it without travelling and it is still the link it always was, into that node's own page.

That line answers two questions at once, because the gesture asks two: **which gap** it sits in, and **how far in** it starts. Those are different placements that look the same on screen — the last child of the branch above and the next sibling of that branch's parent sit on the same line — so the line moves sideways as you do, and where it starts is the depth you are asking for. Let go and that is where the row is.

**A branch is never offered a place inside itself.** The rows being carried are simply not among the ones a drop can land beside, so there is no gesture that asks for a loop.

What a drop sends is one op per row moved — the same `move_node` an agent would send, naming a parent and the sibling to sit after — so a drop is refused, and says why, exactly as a `Tab` is. ⌘Z takes one back like any other edit.

**Drag it into the other pane.** With a split open, a row picked up in one pane is dropped in the next: carry it across and the same line appears over *that* outline, saying the same two things about it — which gap, and how far in. Let go and it goes there. Nothing about the gesture changes; what changed is that the pane the pointer is over decides where the row lands, rather than the pane the press began in.

Two panes showing the **same file** reorganize each other. The write goes to the file, both trees read the same directory, so the row leaves one pane and arrives in the other on the same frame — you watch it go.

Two panes showing **different files** cannot, and the pane says so before you let go: it fills with the reason and points at the door that can. A drag lands a row in a gap between rows of the outline it is carrying, and a pane of another file draws none of them — there is no gap to aim at. **Move to…** (⌘⇧M) is how a row goes to another outline; it asks for the destination by name instead of by pointer. Let go anyway and nothing moves; the sentence stays on the bar rather than disappearing with the gesture.

**Hold a row near the top or bottom of the window and the page comes to you.** An outline is longer than a screen nearly always, so a drag that could only reach what happened to be visible when you pressed would be most of the gesture missing. The nearer the edge, the faster it moves; move away and it stops. The line that says where the row would land is re-read as the page goes, so it is always about where the pointer is *on the page*. (This one is the *window* scrolling, so it is a lone page's; a split gives each pane its own scroller, and there the reach of a drag is what that column is showing.)

**With a finger, hold the bullet first.** Press it, wait for the row to lift, and then it follows your thumb — the same drop line, the same landing. Until that moment nothing is claimed: a finger that moves before the row lifts is scrolling the page, exactly as it always was, and that is true whether it started on a bullet or anywhere else. The bullet is the handle on every device, which is why holding a finger *there* no longer opens the row's ••• menu — holding the row anywhere else still does.

## Picking several rows

A plugin rebuild of the same page preserves the picked rows and the anchor used by Shift-click and Shift-arrow. Bulk actions continue to use those rows. Explicit navigation clears the pick, and returning to the outline starts with nothing selected.

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

An unsubmitted date or repeat choice stays with its row and pane when plugins rebuild the page or you switch phone pane tabs. Filtering that same outline does not change its ownership. Leaving the page, cancelling, or collapsing the parent discards the draft; opening the picker again starts from the stored value. Two panes of the same outline keep independent choices.

A pending submission stays disabled across pane switches, and a refused choice keeps its explanation. While a write waits, keyboard focus stays in the form so Escape still dismisses it. Dismissing an already submitted form does not undo its write; its late response cannot close a newly opened draft.

On a phone, picker labels wrap and controls fit the space left by the row's indentation, including nested rows and long repeat options.

A node scheduled for a time of day rather than a bare day keeps whatever it says on disk until you pick — the box shows the day that time falls on, and the panel says what picking one would replace, because a picker picks days.

The row moves the moment the file says so: a task given a day that has gone is above now on the agenda’s spine and on that day's page, without a reload and without this page deciding anything for itself.

**The agenda lists work.** A dated `todo` or `doing` is owed — on the spine, in the overdue count, on the burning Agenda entry. A dated bullet is not: a birthday, a delivery, a note pinned to a day stay on that day's page and in the calendar's dots, and never on `/agenda`. Marking the bullet a task is what puts it on the agenda; taking the mark off is what takes it off.

## Making a node come back

A dated node can say **how often it repeats**, and completing it makes the next occurrence.

**The pill beside the date is the control**, and it reads the rule in the words the file holds — `↻ every week on monday`. Press it and the picker opens under the row, exactly where the date picker opens; the ••• menu is the other door, with **Set repeat…** on a dated row that does not repeat and **Change repeat…** on one that does. Only a DATED row is offered it, and that is the format's rule rather than the menu's: the rule says how often and the date says when the next one is, so **Set date…** — directly above — is the thing to do first.

What you get is a list, and the list is the whole grammar: **every day**, **every week on** each of the seven days, **every month**, **every year**. There is no box to type a rule into, because there is no rule to type that is not in the list — no `every 2 weeks`, no end date, no count. **Set repeat** writes it, **Escape** and **Cancel** leave without writing, and ⌘Z takes it back. Choose **Does not repeat** and the button becomes **Stop repeating**, which is the ••• menu's own verb and the same write.

**Completing it is what makes the next one.** `Ctrl+Enter`, the checkbox, **Complete** in the menu — any of them — stamps the row done as always, and captures a fresh node immediately below it: same title, same note, same rule, on the day the rule names, marked `todo`. The line under the row says which day that is. The old row keeps its own date and its `done` instant, so the day page for the day you finished it still shows it: eleven weeks of bins are eleven rows on eleven days rather than one row whose date kept moving.

The rule moves to the new node, and the finished one stops repeating — a recurrence has exactly one live head. Two things follow, and both are the answer to "what if I ticked it by mistake": **⌘Z puts the mark back and leaves the new occurrence**, which is still owed, and **completing it again makes no second one**, because the rule is on the row below now. If the new occurrence is not wanted, **Stop repeating** it or move it to the Trash.

**Calling one off makes no next one**, which is the one place the two settling marks part company. Finishing this week's says the chore goes on; ⌥Enter says it does not, so nothing is spawned and the rule stays on the row you cancelled — which is what makes the decision reversible: take the mark off and you have the dated node back with its rule intact, and the next ⌘Enter starts the series again. **Stop repeating** is still how you end a recurrence outright.

**The next occurrence counts from the row's own date, not from today.** Finish a weekly chore three weeks late and the next one is the week after the one you just finished — which is still in the past, and still genuinely owed. Nothing here quietly skips a backlog forward; cancel the ones that are not happening.

Everywhere else, the new occurrence is simply a dated node: on the agenda, on its day's page, in the calendar's dots, overdue when it goes past — read exactly as the one before it was.

## What a node says about itself

A node's **properties** are named facts on it ([format.md](format.md)) — `pr`, `agent`, `isbn`, whatever a reader wants to be able to ask about later. They live in the record's one open field, `custom`, and they are drawn under the node's title as a **run of chips**: one small bordered pill per fact, the key mono and muted, the value first-class. One wrapping line, reading like a byline under a headline. Never a grid and never a form — a table under every open row turns an outline into a spreadsheet.

**They are shown on the row automatically, open or not.** A fact behind a fold is a fact nobody reads, and a property is a short fact by rule — the display's job is to make five of them cost one line rather than five, not to hide them. So what a pilcrow opens is the **note** and the `see` references under it, and nothing else; a node whose only body is properties wears no ¶ at all, because there is nothing behind one.

**They are drawn in the file's own order, never alphabetical.** A record olai wrote is alphabetical on disk — the writer canonicalises so that two files meaning the same thing are byte for byte the same — but that is the writer's doing rather than the drawer's. A record a hand or an agent edited keeps its keys in the order the person thought about them in, `agent` then `brief` then `worktree`, and the run reads it back the way it was written.

**A row draws the custom keys only.** The node's own facts are already on the row: the mark is the glyph, the date is the badge, the repeat rule is the pill beside it, the id is where the bullet goes, and repeating them under the title would put two spellings of one fact on one screen.

**A value that names a thing is a link.** The whole value has to BE the name of the thing — there is no fuzzy matching, no "looks like", no title search, because a wrong door is worse than no door:

- a **path in this directory** opens that file's page, and only when the directory actually serves the answer — a path that is not there is a string that turned out not to be a path, rather than a broken link. WHERE it is resolved from is the key's own business if the vault declared one (`base: root` or `base: file`, [format.md](format.md#the-basis-where-a-doc-or-path-value-resolves-from)); a key nobody declared is resolved beside the file the value was written in, exactly as a relative link in a note is;
- a value that **is a node's id** opens that node, so `reviewer pi` becomes navigation when `pi` is a node the set declares. **By id and never by title**: titles are prose, two nodes may share one, and a value that merely reads like a title is a guess;
- a **URL** (`http:`/`https:`) opens in a tab of its own, under the same rules a link written into a note takes;
- a **date** — a day or an instant on one — wears the same date badge the row speaks with, and opens that day's page;
- `owner/repo#123` opens that GitHub issue or pull request. A bare `#123` does not: which repository it means is a fact nowhere on the screen.

**Every kind works the same on a node and in a document's frontmatter.** It did not use to: a node id resolved against the ids the page's set declared and a `.md`'s block was not a record, so `author: pi` was navigation on a node and plain text in a document. That was a consequence of where the question was asked rather than anything anybody decided, and it went away when one place started answering it — a chip is a chip wherever it is drawn.

**A key the vault DECLARED is answered by its declaration** rather than by the list above, because a declaration is a stronger warrant than any guess ([format.md](format.md#what-a-declared-value-names)). A key declared a kind a PLUGIN contributed — `worktree`, `terminal` — names a checkout or a terminal, neither of which is a page this app has, so neither is offered as a door and the plugin's own face draws it; a `brief` opens the file when the directory has one; a `ref` opens the record it names. A `doc` is held to the *same* answer the write gate gives — it is the one kind that promises its value names a served document, so a value the validator refuses is never a live door here. A declared `text` reads exactly as an undeclared key does, which is what keeps the URL in a `pr-url` a link.

Anything else stays the text it is. A value with a URL *inside* it is not a URL — `#365 https://…/365 @ efc32b13 — reported 12:45` is a paragraph, and pulling the URL out of it would be the display deciding which part of your sentence was the point.

**Prose too long to be a fact is drawn as its first words**, with the rest one press away. That fold is a safety net rather than a place to put things: properties are short facts, prose belongs in the note, and the fold is only what stops a record that broke the rule from putting a wall back on every row of the page.

**A value that NAMES something never folds, however long it is** — a name is one token, not prose, and a URL and a deep vault path are exactly the two door kinds most likely to run long. What a long door does instead is sit on one line with an ellipsis, still a link, with the whole of it in the pointer's tooltip. The ellipsis is the browser's, so the value in the page is still the value in the file. Its width is limited by the space available in the chip as well as the desktop maximum, so a nested row on a phone keeps the link on screen.

**A node's own page draws them all**, read-only ones first: its `id`, the mark it has, its `date`, and the `created`/`changed` stamps when it has them. Those have nowhere else to be read — the id in particular is what every tool call and every `((` reference takes. They are above the note there, as on a row: facts above the line, story below it. **The read-only half takes no links** — each of those is a field with a face of its own, and the `id` would be a link to the page it is drawn on.

**A document's own page draws the same run**, under the path heading and above the body — the custom keys only, because a `.md` has no system facts with nowhere else to show (the path is already the heading). The facts come from the file's YAML frontmatter ([format.md](format.md#documents)), the same open namespace a node's `custom` is. A file that wrote no block draws nothing there. The run is off while the editor is open: the editor is the YAML, and two spellings of one record on one screen is what the drawer exists not to be. There is no *Add property…* on a document; writing the block is editing the file.

**A chip is where the property is written**, in place, under the title where it is read. The gesture is one sentence: **a link goes where it says, and everything else in a chip opens it for editing** — with the KEY always doing so, whatever the value is. The key is the promise because it is the half of a chip that is never anything else: `brief` is a label whether `finishes.md` turned out to be a document or a typo, so *press the label to change the fact* has no exceptions to learn. A value that is not a link is the second way in, because inert text beside an editable label is a dead zone your hand reaches for first.

**Enter** commits. **Escape** cancels. Leaving the box commits what changed, and is silent when nothing did — opening a chip and clicking away is a gesture you make several times a minute, and it must not be an error message. ⌘Z takes a write back. What goes out is the same `set_prop` an agent sends, judged by the same planner and refused in the same words — and it goes out _conditional on the value you were shown_: the write carries what the key said when the box opened, so any hand that moved the key while the box sat open (an agent's `set_prop`, another tab's commit) turns yours into the refusal that says what is there now, rather than into a silent overwrite. An agent's `set_prop` can spell the same condition itself, as `was` ([format.md](format.md)); left off, the write is last-one-wins as it has always been.

**A ref chip draws the variant's TITLE, and holds its id underneath.** A `ref`-typed value is an id ([format.md](format.md#typed-properties)) — `auto`, `merge-human`, `agent-claude-opus` — because names rename and ids don't. What a reader wants is the name, so the chip reads `automatic` and the pointer is told `auto`: the face is the title, the tooltip is the stored truth, and the file goes on holding the id that `set_prop` takes. Every other chip draws the value verbatim, and that is the rule with exactly one exception — a value the vault declared a REFERENCE is the only kind whose name is not its identity.

**A refusal is shown, verbatim, under the run.** A key the vault declares has a type ([format.md](format.md#typed-properties)), and a value that does not fit it is turned away by the same planner an agent's `set_prop` meets — so typing `AUTO: grok review folded` into a `merge` chip does not quietly revert: the chip closes, the file keeps what it had, and the ops layer's own sentence appears under the run, naming what the key may hold and offering the nearest one. It lingers a few seconds and clears, like every other thing this app says about a write. The one thing it is not is a summary: the words that say WHY are the refusal's, and a face that paraphrased them would be one that threw the answer away and kept the failure.

**Clearing the value removes the property.** That is not a shortcut this face invented: `set_prop` with an empty value takes the key off exactly as `null` does, so emptying the box is the removal verb, spelled the way you would expect to spell it.

**The `+` at the end of the run adds one**, and it is the only place a key is ever typed. A rename is not a write this format has — `set_prop` sets ONE key, so changing `pr` to `PR` is removing one property and adding another, which is two ops and therefore two gestures. An existing chip's key is a label, not a box.

**A key holding a LIST opens like any other**, though only a hand-edited file can produce one. Clearing it removes the key, exact whatever it held — which is the whole reason it opens. Typing over it replaces the list with the text you typed, because `set_prop` writes one key one value and there is no way to write a list back; committing it unchanged writes nothing, so a list cannot be flattened by opening a chip and pressing Enter. Editing a single member is a hand-edit of the file, which is what wrote the list.

**The `•••` menu carries one property entry, and only on a node that has none.** It used to grow *Add property…* plus an *Edit `pr`…* and a *Remove `pr`* **per property** — so a node carrying eight facts had sixteen menu entries about them, and the menu got longer every time you wrote something down. All of that is gone with the panel it opened. What is left is the one case the `+` cannot reach: a node with no properties has no run for a `+` to sit at the end of, and drawing an otherwise-empty run under every row of a tree would cost a line per title. So there is exactly one door at any moment and never two.

**The node's own facts are not writable there.** Each of them already has a verb — the mark section, *Change date…*, *Change repeat…*, the two edge verbs — and `set_prop` refuses every one of them by name, so their keys are labels rather than buttons.

**A zoomed node writes its own properties now**, which it could not before: the `•••` hangs off a row, so a node's own page drew the whole drawer and had no door to any of it. Every chip there is edited where it is read, and the run on that page always draws the node's own facts, so the `+` always has an end to sit at.

## What a node points at

Open link and prerequisite panels retain their relation and search query when plugins rebuild the same page, both on outline rows and zoomed headings. Cancelling or opening a fresh relation clears the search; navigating away discards the prepared panel.

A node carries two lists of other nodes ([format.md](format.md)): `see`, which is a link and nothing more, and `after`, which is what it must come after. The page has drawn both for a long time — the links under a node, and, for a blocked row, the dim, the mark column's glyph and the **blocked by** line on its own page. Both can be written now, from either end.

**The `•••` menu has the two verbs**: *Link to a node…* and *Wait for a node…*. Each opens a panel under the row holding what the node says now, with an `×` on each of them, and a box that searches the whole directory — the server's own search, the same one ⌘K, the header box and `((` use, so what this finds and what an agent's `search_nodes` finds cannot drift. Walk the hits with the arrows, take one with **Enter**, leave with **Escape** or **Done**. Choosing one sends the same `set_see` / `set_after` an agent sends, and ⌘Z takes it back.

**A zoomed node has the same two**, as controls under its own lines, because a heading has no `•••` to hang them off — the gap the ⌘K palette's op rows close for the verbs that need no second gesture, and cannot close for the ones that open something (`Set date…` is the same case).

**A node's page draws the two lists apart, and only one of them is yours to change.** `after` is the field this node carries, so it has the `×`; **blocked by** is DERIVED — what is in the way *right now*, which is unfinished work only, and which may be a `blocks` written on somebody else's record. Those are different claims, and an `×` on the derived one would name no single edge.

**A loop is refused, in the ops layer's own words, naming the loop.** `after` is the ordering graph, so `a after b after a` is a set of tasks none of which could ever start; asking for one is answered with *`order` after `install` closes a loop — `order` → `install` → `order`* under the panel, which is the sentence an agent's `set_after` gets. Nothing is greyed out first: the entry is offered on every node and the reason arrives when it is asked for, which is the same rule the mark verbs keep for finished work. A `see` loop is refused by nothing, because two notes pointing at each other is a thing people write on purpose.

Both are facts about the node a row SHOWS, so choosing one at a mirror writes the node it stands for — a placement carries no edges of its own.

## Taking an edit back

**⌘Z takes back the last edit you made on this outline** — and it is not a restore. When a key moves a row, ticks something off, or commits what you retyped, the server records what would REVERSE it (the parent and neighbour the row had, the mark it replaced, the words it replaced) and ⌘Z sends that, through the same gate, judged against the outline as it is now.

Which is what makes it safe to share an outline. An undo cannot quietly take back what the agent, another tab or a `git pull` did in the meantime; one that no longer fits — the row moved, somebody filed work under it, somebody retyped the line — says so instead of guessing, in the words the write gate would use. It is your own edits, on the outline in front of you: a hundred of them, this session, this tab. Changing plugins preserves both undo and redo history, including the checks against other writers’ changes. Open another outline and it starts again.

While you are still typing, ⌘Z is the text box's own, exactly as it is anywhere else. The outline's undo starts once the line is committed, which is the moment it became something anybody else can see. If you click away and immediately undo while the save reply is still pending, Undo waits for that save; it cannot spend an older edit instead. Navigating to another file also discards any inverse still awaiting its reply.

**There is no delete key.** What ⌘Z can take back is a row you have just made — the un-create, which is the inverse of the `Enter` that made it. Where it goes is the Trash, keeping its id, which is what putting anything away does: a trash rather than a shredder, refused outright once anything has been filed under it, and not something a key of its own can ask for.

## The Trash

The `•••` menu's **Move to Trash** puts a row and everything under it away, behind a question that names how many rows go. Where they go is `_olai/Trash.olai` on disk — the one trash for the whole directory, whose tool for the same gesture is `trash_node` — and to a person it is the **Trash** under the sidebar's `olai` parent at the foot: readable and not editable, each subtree drawn under the outline it left and the chain of ancestor titles it hung off.

**What goes in leaves every other page** — by **Move to Trash**, or by the merge above that files the row it joined (ruled 2026-08-17). A row in the Trash is off its day, out of the calendar's dots and off the agenda even if it was overdue — putting something away is saying you are done looking at it, and the Trash is the one page that shows it. Nothing on disk changes for that: the record keeps its dates and its mark, **Put back** returns it to its days along with its outline, and `is:trashed` finds it from any search box in the meantime ([search.md](search.md)).

Not every row in there is a thing you put away. Above each pile sit the **titles the trash wrote down to remember which outline it left and where it hung** — so the tree still reads years later — and those are signposts rather than nodes: the ones they name never left. Pressing **Put back** on a signpost says so, and names the live row that still carries the title. What comes back is what went in.

**Put back** is the one verb a Trash ROW has, and it is the whole reason the Trash is a trash. It sends the same `untrash` op an agent's `untrash_node` sends — the op both faces got in the same change, because neither face may do what the other cannot — and the subtree returns where the recorded chain says it came from, last among its new siblings, children and ids intact. A chain that no longer stands (retitled, or put away itself) is a refusal in the ops layer's own words under the row, never a guess; an agent can name a destination outright, and restoring the chain first is the way through for the mouse. ⌘Z after a Move to Trash puts the row back too — the undo knows the exact parent it sat under — and ⌘Z after a Put back is the trash again.

### Emptying it

**Empty trash**, beside the heading on the Trash page, is one of the two things in olai that permanently deletes ([below](#deleting-a-file) for the other one, which works at file size). Everything in `_olai/Trash.olai` goes — the subtrees you put away and the signpost titles above them — and it goes for good: there is no second bin behind this one, no ⌘Z, and no put-back.

It asks first, and the question **names how many rows go**, counted over what the trash actually holds rather than over what the page is drawing. Filter the Trash down to one row and press it, and the sentence still says all of them, because that is what the write moves. **Cancel** writes nothing at all. That number travels with the write, too: if something is put away between the moment you read the sentence and the moment it lands, the write is refused naming both counts rather than quietly taking the newcomer with it.

**What survives is whatever git has already recorded**, which is what the question says and all it says. The records leave the trash through the same gate every other write goes through, and the emptying is committed by whichever door commits everything else ([git.md](git.md)) — so a directory that is a repository can find them in its history, one served `--no-commit` cannot, and neither can one whose trash has been sitting uncommitted since you put the row away. Nothing here reaches into git on your behalf; recovering a deleted record is `git log`, `git show` and a paste, in a terminal.

**It is refused while anything outside the Trash still points into it.** Ids come along when a subtree is put away — that is what makes a mirror, a `see` or an `after` naming what you put away go on resolving — so deleting those records would leave live rows naming ids nothing declares. The refusal is the ops layer's own sentence on the page, naming each row and the field it points with; re-point or retire them, or **Put back** what they name, and press again.

**An empty Trash does not offer the verb at all**, which is the same rule the page's own "The Trash is empty." keeps: whether there is anything to delete is a fact about the trash, and a filter that matched nothing is a fact about the query.

An agent's `empty_trash` is the same op: it names `_olai/Trash.olai` and empties that one file — leftover `Archive.olai` files are not the trash and are refused.

Deliberately absent, and still the human’s to rule on: a delete key. Emptying the Trash is not one — it names no node, reaches no live outline, and can only take rows you have already put away and can still see.

## What the sidebar leaves out, and the one door under it

**The file tree does not draw `_olai/`** — the outlines olai names for itself — and they are not hidden either: they have a home of their own at the foot of the column, nested under one special parent named for the house itself — **olai** — beside the Trash door that also lives there (ruled 2026-08-31: one mechanism, one parent, one door for the vault's own furniture; the Trash's top-level entry was absorbed into it). The parent is no page and no fold — the rows under it are the doors — and each opens the ordinary outline it is. The pinned shelf above the tree already IS `Pins.olai`, **Inbox** sits beside Agenda at the top of the column (human, 2026-08-20) — the group keeps the last mile: the inspectable remainder, a click each, without rows in the tree stacked on top of your own outlines. The rule replaced a **Prefs** switch — Hidden outlines, on this panel for the same files — with the group, because inspectability you have to set is inspectability you have to know to ask for.

**It is a drawing rule and nothing else.** Those files are in the directory either way: search finds them, an agent's `list_outlines` lists them, the Trash page and the shelf read them, and git records them like anything else. What changes is one list of rows in the directory column.

**Except one that would not parse.** An outline olai could not read still wears the ⚠ every unreadable outline gets — on its row under the parent, at the home those files live in, because that mark is the only place this app says so short of opening the page: a `Pins.olai` with a bad line in it is otherwise an empty shelf and no explanation anywhere.

**The Trash nests rather than listing: it is a page rather than a file you edit**, so the HOUSE's row under the parent is its page's door, and the file the page reads — `_olai/Trash.olai` — is the one `_olai/` outline the tree does not draw even conceptually ([format.md](format.md)).

**The Inbox entry is drawn only when there is an inbox.** A directory that has never captured has none, and minting one is the capture's job, not a door's — so the entry appears the moment your first `⌘K` `+` lands and opens the file that capture went into. It sits **beside Agenda**, and it wears Agenda's own count badge: **the rows in the inbox marked `todo` or `doing`, at any depth. Full stop.** A marked row is one awaiting you; an unmarked row — a plain bullet or an emptied header — is furniture to it. A done or cancelled row has been seen to, so it leaves the count. The chip hides at zero — an empty inbox is a door, not news — and a file that holds only placements is the same zero: a mirror is a view of something elsewhere, not a row of the inbox's own. It is an ordinary outline behind that door — type into it like any other — so the entry lights up when you are on it and carries the ⚠ when the file will not parse.

## Pinning a page to the sidebar

A **shelf of doors** in the directory column, between the calendar and the file tree: any node, any document, and the page you have narrowed with a query — one click back to it. An empty shelf draws nothing at all, so a directory that has never used one has the column it always had.

**Three ways on, and they are one gesture over one address.** A row's `•••` offers **Pin to sidebar**, and offers **Unpin from sidebar** on a row already up there — one entry with two labels, because the shelf already knows which way this node's answer goes. `⌘⇧P` / `Ctrl+⇧P` does the same for the PAGE you are on, and it is live while you are typing a filter, which is exactly when "pin this, narrowed like this" is the thing you mean. `⌘K`'s **Pin this page** row is that chord for a hand on the mouse.

**A pinned page keeps its query.** `/agenda` filtered to `is:todo` is pinned as that whole address, drawn with the query beside its name, and clicking it lands on the agenda WITH the filter in the box — which is what makes a pin the way a saved search is spelled here ([search.md](search.md)).

### Naming one, where the thought arrives

**A NARROWED page is asked what to call it, and nothing else is.** Every other address already has a name that is read live — a node's own title, a file's filename, the word *Agenda* — and a copy of one stored beside the pin is exactly the stale second answer this convention exists to avoid. A QUERY is the part nothing in the directory can name: three saved searches on the agenda are three rows called *Agenda* until somebody says otherwise. So `⌘⇧P` on a page you have narrowed, and the `⌘K` row that says **Pin this page…**, ask for a name first; a page with no query, and every unpin, still writes in one press.

**It is asked in the palette's own box**, the way `+ a line` already asks for a line: the words you type are the name, the box wears the name it would take otherwise (*Agenda*) where a placeholder goes, and **Enter** writes it. Three keys, and each of them is worth knowing:

- **Enter with nothing pins it unnamed** — the bare address this app has always written, one keystroke from where your hand already is. Nothing derived is ever stored, so *Agenda* on the shelf goes on being read live.
- **Enter with words pins it named**, as one write: the row's title becomes `[What is late](/agenda?q=is%3Atodo)`, which is the markdown link you would have typed into `Pins.olai` yourself.
- **Escape writes nothing at all.** The question comes before the pin, so backing out of it backs out of the whole gesture. Backing out is not a mode, either: the chord works again on the next press.

**A question owns the modal while it is up.** `⌘⇧P` pressed again over its own question does nothing at all — the question that press would ask is already on screen, and asking it a second time would hand the box back its opening words over the name you are half-way through typing. It is the same rule the caret, Tab and Escape already keep there: a question is answered or backed out of, and nothing pressed elsewhere becomes its answer or writes past it.

**And a pin already on the shelf is renamed from the shelf.** Hovering a row shows a `✎` beside its `×`; pressing it asks the same question, holding the name it has now, and **Enter with nothing takes the name off** — the row goes back to a bare address, drawn by whatever it points at. Renaming is an ordinary title edit on that row (`set_title`, the op an agent sends), so `⌘Z` takes it back like anything else.

A name the link cannot hold is refused rather than mangled, in the palette's own line: a `]` would end the label early and leave a title that is no longer an address, which would take the row off the shelf without saying so.

**A pinned node says its name now, not the name it was pinned under.** Rename it from its own row, from another pane, from an agent, from vim — the shelf follows on the frame the file arrives, because there is no copy of the title stored beside the pin ([format.md](format.md#pins)).

**Drag a pin to reorder the shelf**, exactly as a row is dragged in the tree: press, travel, and a line shows where it will land. What it sends is the same `place` a drop in an outline sends. A press that does not travel is the click it always was.

**The `×` takes one off**, and so does the verb it was put up with. Unpinning is the set's own removal — the pin's row goes to the Trash keeping its id — so `⌘Z` takes it back and **Put back** is there if you find it later.

**A pin's NAME is that row's text, whoever typed it.** A title written as a markdown link — `[Kitchen project](/#abc123)` — draws *Kitchen project*, pressing it opens the address, and the query it carries is still drawn beside it. There is still no rename verb and no field: the `✎` above and an edit in `Pins.olai` are two hands on one row, and both leave the same line behind. A bare address takes its name from whatever it points at, live.

**And the file reads like an outline.** Open `Pins.olai` and its rows are the same faces the shelf draws — the pin mark, the name, the query — because a title that names a place is drawn as that place wherever it appears, not just in the sidebar. On a named pin the label is the link; click anywhere else on the line and the editor shows the title as it really is, which is the same thing every markdown title does.

**It is a file, and that is the feature.** The shelf is a `Pins.olai` in the served directory — wherever you keep one; olai mints `_olai/Pins.olai` the first time you pin something and never moves a shelf you already have. One ordinary node per pin, whose title is the address ([format.md](format.md#pins)). Open it like any outline and edit it; a name is a markdown link around the address (`[What is late](/agenda?q=is%3Atodo)`), which is exactly the row the app writes when you type one; commit it with everything else. An agent adds, reorders, renames and removes pins with `add_node`, `move_node`, `set_title` and `trash_node` — the same four ops the gestures above resolve to — so what you keep on that shelf is something you can hand to one.

## From the ⌘K palette

The palette goes places and asks the agent ([search.md](search.md)); it writes two things as well, and both of them are the same op through the same gate as everything above.

**An untouched palette has nothing chosen.** The rows a node can take are listed first, where you can see them, and that is only safe because the highlight is where the arrows START rather than a choice you made: press ⌘K and Enter and nothing happens. The first character you type is the choice, and it lights the best match; ↓ is the other way in.

**The verbs of the node you have ZOOMED.** On `/#<id>`, the palette lists what that node can take — `Mark todo`, `Complete`, `Cancel`, `Clear mark`, `Clear date`, `Duplicate`, `Move to Trash` — the entries of the row's ••• menu that need no second gesture, decided by the same rule (a verb that would change nothing is not drawn), naming the same ids, and refused in the same words. Each row says which node it is about on its second line, because a palette is opened from anywhere. This is the affordance the zoomed node never had: the ••• hangs off a row, and a zoom is a page.

On any other page there are none of them. A command read out of context must not be aimed at a node you cannot see, and what the address says you are looking at is a fact you and the palette can both see.

**The four that ask something first stay where the asking happens** — `Set date…`, `Set repeat…`, `Link to a node…` and `Wait for a node…`. Each opens a panel that hangs off a row, and a palette drawn over the page has nothing to open; a zoomed node reaches the two edge verbs from its own controls instead (above), and the two pickers from its row. `Move to Trash` asks its question in the palette's own box, with the same sentence and the same count the menu asks. **The question takes the caret when it is raised** — so Enter answers it, Tab cycles its two ways out, and Escape or **Cancel** backs out. Nothing you type elsewhere becomes the answer.

**One write at a time.** The gate is a round trip, and a second Enter while the first is still out is two writes for one intention — so the second is ignored rather than sent, exactly as the date picker's button already worked.

A refusal, or a nudge from a write that landed, is drawn in the palette and the palette stays up: a modal that closed on top of the reason would be exactly the silent failure this app is written against. A write that landed with nothing to add closes it, which is what choosing a command means. Either way ⌘Z takes it back — one undo stack, whichever hand made the edit.

Those responses belong to the query that sent them. Typing a newer query or closing and reopening the palette prevents an older write or plugin command from closing it or displaying its old response there. The original action still takes effect.

## Quick capture

**`⌘K`, `+`, the line, Enter** — and nothing moves. The page you were reading, your scroll and the address stay exactly where they were; the line becomes a node; the box empties for the next one, so several thoughts arriving at once cost one chord.

If you type the next thought before the first capture answers, those newer words stay in the box. The confirmation still names the line that landed. A refusal does not label corrected input as invalid, and closing and reopening the palette prevents an earlier capture from changing its new query or message.

It lands at the top level of the directory's **inbox** — the outline called `Inbox.olai`, wherever the directory already keeps one, and a new `_olai/Inbox.olai` when it has none. Minting it is part of the same single operation as the line, so a capture that is refused leaves no file behind. Which file that is is decided on the server, against the same reading the write is judged on, exactly as a daily note's path is.

**Where a new one is minted moved to `_olai/`** (ruled 2026-08-20, reversing a ruling of the day before that kept it at the top level): an inbox olai made because somebody pressed `⌘K` goes where the shelf and the trash go. Only the mint moved. A directory that already keeps an `Inbox.olai` at its root, or a `notes/inbox.olai`, goes on capturing into the file it has, nothing is migrated, and the **Inbox** entry in the sidebar opens whichever file that is.

The palette says so afterwards — a write whose whole point is that nothing on screen moves has to say it happened — and ⌘Z takes a capture back like any other write. An agent makes the same two moves by hand (read the outlines, then `add_node` or `create_outline`), so nothing here is a reach the tools do not have.

The **Capture to the Inbox** row in the palette is the same gesture for a reader who has not been told about the prefix: choosing it types the `+` and leaves the caret after it.

### …from somewhere that is not olai

The same inbox has a door that is not a page: `olai surface capture`, one line from a terminal, a Raycast script pointed at Mail.app, or a cron job that noticed something ([running.md](running.md#quick-capture-from-a-terminal)). It resolves the same convention against the same reading and is the same write — a capture that arrives that way is an ordinary row in the same file, and the **Inbox** entry above lights up for it exactly as it does for a `⌘K` one.

**Two things differ, and both are about the gesture rather than the door.** A capture sent from away carries a **date**, so it is on the day's journal page too — you were not looking at the inbox when you sent it, and a day is where a thing that arrived gets noticed. And it can carry a note under the line, which the palette's single field has nowhere to put. Who sent it is recorded as `captured-by`, the identity that door already has — the login a reverse proxy injected on the request, and nothing at all on a direct loopback call, where the property is simply left off.

Either way the row is **born `todo`**: the badge reads marks and nothing else, so a capture minted unmarked would be invisible to the door the moment it landed. (Rows captured before this ruling were plain bullets and stay uncounted — mark the ones you still owe.)

**And the two stamps of an away capture date compose into due work, which the date alone was not.** A capture sent from away carries a `date` AND the born mark, which is exactly [format.md](format.md#days)'s definition of *work owed to a day* — so it ticks that day's **Agenda** count the moment it lands, and from the next morning it shows **overdue** until somebody gets to it. Ruled that way (2026-08-29): a capture you owe is owed. The palette's `⌘K` `+` is untouched by this — it mints no date, so its rows are the badge's alone.

⌘Z does not reach one, which is the honest answer rather than an omission: an undo stack is a browser's account of what *this tab* did, and nothing was pressed here.

## Starting an outline

**The sidebar's `+ New outline`** asks for a path — relative, under the served directory — and mints the file there. Enter creates it, Escape puts the box away, and the page it lands on is the new outline's, with the same *write the first line* the empty-outline page has always offered.

Both new-file boxes show **Creating…** while their write is pending. You can type the next filename, but Enter does not submit another write until the first finishes. Its response cannot clear the newer name or put an old refusal under it. Escape dismisses the box without undoing an already submitted creation; reopening it starts a new draft. Plugin changes preserve each box’s filename, refusal and pending state independently, including changes made in another tab.

If you navigate or change panes while creation is pending, the file still lands, but the response leaves your newer view in place. A later visit to such a document opens it for reading; **Edit** starts writing as usual.

**The suffix is the door's half, so you may leave it off.** `Foo` and `Foo.olai` are the same ask at `+ New outline`, and `notes/plan` mints `notes/plan.olai` — the folders you typed are yours, and only the last few characters were ever in question. Only the suffixes olai actually claims count as one, so a dot inside a name is part of the name: `plan v1.2` is `plan v1.2.olai`, never `plan v1.olai`. `+ New document` is the same door with `.md` in it.

**What names a PLACE rather than a file is not completed at all.** Every suffix begins with a dot, so adding one to a `..` would quietly make `...olai` — an ordinary filename — out of the one thing the operation would have refused. So `..`, `.` and a path ending in `/` go to the ops layer exactly as you typed them, and come back in its own sentence naming what you wrote. A name that merely ends in a dot is a name (`Foo.` is `Foo..olai`), and one that begins with a dot is an ordinary hidden file (`.plan` is `.plan.olai`, which the sidebar lists — olai skips dot-*directories*, not dot-files).

**Typing the OTHER kind's suffix is the one thing the box refuses for itself**, in its own short words: `notes.md` at the outline door reads *`notes.md` is a document, not an outline — type `notes` to make `notes.olai`.* That is a question about which door you are standing at, and the only one this side answers. Every other verdict is still `create_outline`'s, over the completed path, in that op's own sentence under the box: a file the directory already holds, or a path that climbs out of it with `..`.

**An agent still spells the suffix, and that is deliberate.** `create_outline` takes one spelling of a path and demands the `.olai`; the completion is a convenience of a *box*, which knows which kind it makes because a person clicked one of two doors. An agent naming a file is naming a file, with no door around it — so the tool contract is unchanged and stays one spelling. This is the consistency rule read the way it runs: nothing this face can reach is out of an agent's reach.

That first line is where this differs from the tool, deliberately. `create_outline` can be born holding a whole tree, which is what saves an agent a second call; a person types the row where it is going to live, so there is nothing here for a seed to be filled from. Nothing this door can reach is out of an agent's reach, which is the direction the consistency rule actually runs — and quick capture already sends a seeded create when the directory has no inbox.

**No door here takes a file back.** An outline minted by mistake is deleted the way any emptied outline is ([below](#deleting-a-file)), by its own page — an un-create is deliberately not what ⌘Z reaches for, because a mint is a write you meant: what you did not mean is the minting, not the file. So this undo says nothing to take back, exactly as it does after a new document.

## Writing a document

A `.md` under the served directory has always had a page; the page can be written now. **Edit**, on its header, turns the rendered body into its SOURCE — a textarea holding the file verbatim, which is the same trade every title and note makes: what you type is the source, and the rendering comes back when you leave. There is no toolbar and no WYSIWYG, because a document is markdown and markdown is text. A `.html` in the directory has a page too and does not have that control: olai shows one and never writes one, and it is drawn — and runs — sealed in a sandboxed frame whose origin is nobody’s ([format.md](format.md#hypertext)). A `.csv`, a picture and a `.pdf` are the same answer for the same reason: each has a page, each is drawn — a table, an `<img>`, the browser's own viewer — and none of them has an Edit control, because `write_document` takes a `.md` and a control there would be a door onto a refusal ([format.md](format.md#the-kinds-olai-only-shows)).

The mode is declared, so leaving it is too — which is where a document differs from a note, and on purpose. A note is one line, entered by a click and committed on blur; a whole file written because a click strayed is a write nobody asked for. So **Save** commits (⌘Enter / Ctrl+Enter from the editor), **Cancel** abandons (Escape), and nothing commits on a timer — a document mid-edit is often half a sentence, and every open tab would see the half.

**Leaving the page abandons it too, and that includes leaving for another document.** A draft belongs to the file it was typed in: open another one and the editor closes with the draft still unwritten, exactly as Cancel would. That is worth saying out loud because the alternative is the quiet kind of wrong — a draft that followed you to the next file could be saved onto it, and where two documents happen to say the same thing (two empty notes, two copies of one file) the conflict guard below would not even notice.

Changing plugins while staying on the document keeps its editor open, with the unsaved text and original conflict baseline intact. Save and Cancel still end that draft; a plugin rebuild never saves it implicitly. Each pane and browser tab keeps its own draft, including when phone tabs show the same file or a neighbouring pane navigates while this one is inactive. Saving in one leaves the others' drafts intact and makes their conflict checks compare against the newly saved text.

A save is ONE op at the same gate as everything else: validated, published on its own revision (the other tab showing this document redraws on the frame it lands), audit-trailed, and WAITING in the commit panel like any other write. ⌘Z takes a saved edit back, by the same rule as a retyped title: the inverse carries the text it expects to find, so it can only take back what this tab wrote. And the answer is earned, not reported: the landed file is read back off the disk before the app calls the save done, and a file holding anything but your text is refused — with what the disk holds and the revision it still published, because a refusal here can take back the answer, never the landing.

**The file can move underneath you, and nothing is clobbered either way.** Edit the same document in vim while the editor is open and the editor says so the moment the disk moves; a Save after that is refused, in the ops layer's own words, with your text kept exactly where you typed it. The refusal has two doors out and both are yours: take what you need and Cancel, or press **Overwrite what is there**, which is the same write minus the guard and means exactly what it says. An agent gets the identical story — its `write_document` takes a `was`, and the refusal is the same sentence.

**Two ways to a document that does not exist.** The sidebar's **+ New document** asks for a path — relative, with the `.md` optional the way `+ New outline`'s `.olai` is ([above](#starting-an-outline)), and otherwise judged by the same rules an agent's `create_document` is judged by — and the day page's **+ day note** mints that day's note, filed where your vault already keeps them: the convention is read off the newest existing daily note's own path (`Daily/2026/08/2026-08-12.md` puts September's first note at `Daily/2026/09/2026-09-01.md`), never configured. The button is shown on any day without a note, whether or not that day has dated entries, and is gone once the note exists. Clicking a calendar day never writes: every cell navigates to `/d/<date>`, and an empty day is the page that says so. Either door lands in the new document's editor, and the sidebar lists the file on the same frame.

## Deleting a file

On phones, the confirmation wraps above its Delete and Cancel controls; both remain reachable even for a long filename. Plugin rebuilds dismiss an armed confirmation, so deleting afterward requires a fresh confirmation.

Beside **Edit** on a document page's header, and beside the *write the first line* an emptied outline offers, sits **Delete…**. It asks first, naming the path — the file's name IS its address here, so the question is the address — and the second press is the write: the file is gone from the directory, the sidebar and every open tab on the write's own revision. **Cancel** writes nothing at all.

**There is no file-level trash, and that is the sentence the question says.** A record's undo story is the Trash's — a `Put back` puts the subtree back with its ids. A file's undo story is git's: the delete rides the same gate and the same commit door as every other write ([git.md](git.md)), so the bytes are recoverable to exactly the extent git had already recorded them. A directory served `--no-commit`, or one whose file was never committed, keeps nothing. ⌘Z does not take a delete back either — what would take it back is a git command, and this app does not shell one for you.

**The verb is guarded, and each refusal says what to settle first.** An outline that still holds records is refused, naming them — this is a delete, not a move: [the Trash](#the-trash) is how a record leaves an outline, and nobody's verb guesses at emptying. A document a `doc` field (or a property declared `doc` in `_olai/Properties.olai`) still names is refused, naming the records that name it — deleting under them would break THEIR files too, which is the finding the validator would show you next. A file olai only shows — a `.html`, a `.csv`, a picture, a `.pdf` — is never offered the control, and an agent's `delete_file` is refused the same way: those files belong to whatever put them there. And a broken file nobody could read is refused too: dropping bytes that never made it into the set is not a delete, it is a loss.

An agent's `delete_file` is the same op at the same gate — minted paths and refusals alike — which is the consistency rule doing what it always does: nothing this face can reach is out of an agent's reach.

An open palette keeps its typed input and question through plugin changes, including a pin name or an unsent capture. Escape still backs out of the question, then closes the palette; reopening starts a new draft.

A pin rename is conditional on the stored title the question was opened on. The planner also requires the row to remain on the active pinned shelf. If another writer removes the pin or changes its name or destination, the rename is refused and the draft remains; dismiss and reopen the question to rename the reviewed pin.
