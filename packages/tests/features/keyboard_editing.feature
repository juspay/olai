@share-scratch
@scratch:good
Feature: Keyboard editing
  The Workflowy loop, without the agent: click a title and type, Enter for the
  next line, Tab and Shift+Tab for the shape, Alt+Shift+arrows to reorder,
  Ctrl+Enter to tick something off, Ctrl+Shift+Enter to walk the mark on to
  what it is not finished at, Shift+Enter for the note.

  Every one of those is one op through the same write gate the agent's tools go
  through, and nothing is echoed: what you see is the file coming back. Which
  is why these are `@scratch:` — they write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios under the still-running server.

  Background:
    Given I open the outline "house.olai"
    # These scenarios tick rows off and keep reading them, so finished work
    # must stay drawn: the per-page default is hidden now (preferences.feature).
    And I show the done nodes
    And I mark the page

  Scenario: Typing a title writes it, and the page follows the file
    When I click the title of "handles"
    And I select all and type "choose the brass handles"
    And I press "Enter"
    Then the node "handles" has the title "choose the brass handles"
    And "house.olai" holds a node titled "choose the brass handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A click in a title puts the caret there, not at the end
    When I click the title of "handles" near its start
    Then the caret is near the start of the line
    And the row being typed holds "choose the handles"

  Scenario: A draft is an editor until something commits it
    # The no-optimistic-UI rule from the other side: what is typed is nowhere
    # near the disk until one of the three moments — and then it is. Both
    # halves, because either one alone is half the promise: a client that never
    # wrote would pass the first, and one that wrote per keystroke the second.
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    Then "house.olai" holds no node titled "pick the little brass knobs"
    And "house.olai" holds a node titled "pick the knobs"
    # Idle is the third moment (blur and Enter are the other two, and have
    # scenarios of their own): stop typing, and it goes. The editor stays open
    # — a commit is not a reason to take the caret away — so the row is asked
    # of the page only after the caret leaves it.
    Then "house.olai" holds a node titled "pick the little brass knobs"
    When I press "Escape"
    Then the node "knobs" has the title "pick the little brass knobs"

  Scenario: Escape abandons what was typed
    When I click the title of "knobs"
    And I select all and type "something else entirely"
    And I press "Escape"
    Then no row is being edited
    And the node "knobs" has the title "pick the knobs"

  Scenario: Blur commits the draft
    When I click the title of "knobs"
    And I select all and type "pick the little brass knobs"
    And I click away from the editor
    Then the node "knobs" has the title "pick the little brass knobs"
    And no row is being edited

  Scenario: Blur commits a BRAND-NEW line, and leaves it too
    # The same promise for the other kind of draft, and it was half kept: the
    # line was written and the caret stayed in the row it had just made. A
    # blur closes the draft only when the editor it came from is still the open
    # one, and committing a new line REPLACES that draft with the row it wrote
    # — a different slot — so the guard read "the reader went somewhere else"
    # about a reader who had gone nowhere.
    When I click the title of "handles"
    And I press "Enter"
    And I type "measure the alcove"
    And I click away from the editor
    Then "house.olai" holds a node titled "measure the alcove"
    And no row is being edited

  Scenario: Enter opens the next row, and it is written when it has a title
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    # Still nothing on disk: an empty new row is not a node, which is why
    # `Enter` opens an editor rather than writing a blank record.
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
    When I type "measure the alcove"
    And I press "Enter"
    Then "house.olai" holds a node titled "measure the alcove"
    And the page has not reloaded

  Scenario: Enter Enter Enter lays out three empty drafts, and writes none of them
    # Outlining is sketching blanks. Empty titles are still illegal on disk, so
    # each line is a local draft until it has words — but the drafts stay on
    # the page, so a skeleton can be laid out and filled in.
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Enter at the start of a line inserts a draft above it
    # Workflowy's "make space": caret at column 0, Enter, a blank above, the
    # words you were on stay where they were. Still a draft, still nothing on
    # disk. What it must not do is teleport the caret to the floor of the
    # subtree — that is what Enter at the END of the line does.
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    Then a new row is being typed
    And the row being typed is drawn immediately above the title of "kitchen"
    And the node "kitchen" has the title "kitchen remodel #home"
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: A titled column-0 draft lands above the row it was opened on
    # The gate above asks the boxes; this one asks the file. `shows exactly
    # the nodes` is a multiset, so "nothing extra was written" is not "written
    # here".
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I type "garage"
    And I press "Enter"
    Then "house.olai" holds a node titled "garage"
    And the node titled "garage" comes before "kitchen"

  Scenario: Clicking a parked draft after titling the live one keeps it above
    # Resume used to capture the ghost before the commit that re-aims it, so
    # the blank above `garage` opened below it.
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I type "garage"
    And I click the first new row
    Then "house.olai" holds a node titled "garage"
    And a new row is being typed
    When I type "driveway"
    And I press "Enter"
    Then the node titled "driveway" comes before the node titled "garage"
    And the node titled "garage" comes before "kitchen"

  Scenario: Clicking away from empty drafts parks them
    When I click the title of "handles"
    And I press "Enter"
    And I press "Enter"
    Then 2 new rows are being typed
    When I click the page away from the drafts
    Then 2 new rows are being typed
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: The line being typed sits where the row will sit
    # A new sibling is drawn at the depth it will HAVE, not one step out of it:
    # the draft reserves the same gutter a row does (the `•••` cell and the
    # collapse triangle), so the line a person types is the line they get.
    When I click the title of "hinges"
    And I press "Enter"
    Then a new row is being typed
    And the row being typed lines up with the title of "hinges"

  Scenario: The row holding the caret says so
    # Walking with the arrows moved a blinking cursor and nothing else, which
    # in a tree of a hundred rows is a pixel nobody finds.
    When I click the title of "handles"
    Then the row "handles" holds the caret
    And no other row holds the caret
    When I press "ArrowDown"
    Then the row "hinges" holds the caret
    And no other row holds the caret

  Scenario: An abandoned empty row writes nothing
    When I click the title of "handles"
    And I press "Enter"
    And I press "Escape"
    Then no row is being edited
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Tab indents under the row above, and Shift+Tab puts it back
    When I click the title of "knobs"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    When I press "Shift+Tab"
    Then the node "knobs" is a child of "install"
    And the page has not reloaded

  Scenario: The first of its siblings has nothing to indent under
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above it"
    And the node "handles" is a child of "install"
    # And the row goes on working: a refused key writes nothing and changes
    # nothing about the editor it was pressed in.
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the brass handles"

  Scenario: Alt+Shift+Up moves a row among its siblings
    When I click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "knobs" comes before "hinges"
    And the page has not reloaded

  Scenario: Ctrl+Enter ticks a row off, and again takes it back
    When I click the title of "handles"
    And I press "Control+Enter"
    Then the node "handles" has status "done"
    When I press "Control+Enter"
    Then the node "handles" has no status

  Scenario: The mark walk writes the two marks Ctrl+Enter cannot, and takes one off
    # `Ctrl+Shift+Enter` is one step round the ring: a bullet, then `todo`, then
    # `doing`, then a bullet again. The last stop is an ANSWER rather than a gap
    # — the format draws it as no box at all — so the walk can take a mark off
    # as well as put one on, and the record it leaves carries none of the three.
    # `done` is not on the ring: finishing something is `Ctrl+Enter`'s, and
    # nothing should tick work off on the way past.
    # The marks themselves are asked of the PAGE, like every other key: nothing
    # is echoed, so a box on screen is a box the file said. The DISK assertion
    # is for the one stop the page cannot make a claim about — no box drawn and
    # no field left behind are two different facts, and the second is the one
    # that says unmarked is an answer rather than a rendering.
    When I click the title of "handles"
    And I press "Control+Shift+Enter"
    Then the node "handles" has status "todo"
    When I press "Control+Shift+Enter"
    Then the node "handles" has status "doing"
    When I press "Control+Shift+Enter"
    Then the node "handles" has no status
    And "house.olai" holds the node "handles" with no mark
    And the page has not reloaded
    And there should be no page errors

  Scenario: Only the STARTING verb refuses — finishing out of order still lands
    # The asymmetry, from the keyboard. `hinges` waits on `order`, which is
    # `doing`. `Ctrl+Enter` ticks it off anyway, because the world outruns the
    # plan and a tool that will not record what happened is a tool that gets
    # lied to. Only the instruction — start this now — is refused. (What
    # `Ctrl+Enter` IS refused over is what hangs below the row rather than what
    # it waits on: done_over_open_work.feature.)
    When I click the title of "hinges"
    And I press "Control+Enter"
    Then the node "hinges" has status "done"
    And "house.olai" holds a node marked done titled "pick the hinges"

  Scenario: The keys keep working after the row has moved
    # The caret is what a structural op nearly costs: the row is redrawn where
    # the file says it now is, which in a browser takes the focus off it.
    When I click the title of "knobs"
    And I press "Tab"
    And I press "Shift+Tab"
    And I press "Alt+Shift+ArrowUp"
    And I press "Control+Enter"
    Then the node "knobs" has status "done"
    And the row being typed holds "pick the knobs"

  Scenario: An indent leaves the caret where it was in the line
    # The other half of the sentence above, and the half that was missing. An
    # indent changes the row's `Row.key` — the chain of ids down to it — so the
    # branch the editor was drawn in stops matching and a DIFFERENT one starts:
    # the box is not moved, it is replaced, and a fresh box opens at the end of
    # the text. A reorder keeps the key and so keeps the box, which is why
    # `Alt+Shift+Up` never showed this
    # (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md`'s 4.10).
    When I click the title of "knobs"
    And I put the caret after "pick"
    And I press "Tab"
    Then the node "knobs" is a child of "hinges"
    And the row being typed holds "pick the knobs"
    And the caret is at offset 4
    # ...and back out again, which is the same key and the same claim.
    When I press "Shift+Tab"
    Then the node "knobs" is a child of "install"
    And the caret is at offset 4
    # And what is typed lands where the caret is, rather than at the end of a
    # line somebody was in the middle of — which is the thing a reader would
    # actually notice.
    When I type " out"
    And I click away from the editor
    Then "house.olai" holds a node titled "pick out the knobs"
    And there should be no page errors

  Scenario: Clicking the note you are reading puts the caret in it
    # The human's call over the textarea this shipped with, mapped onto olai's
    # fold: the pilcrow opens the row (and that open note is where a row draws
    # its rendering and its see links), and a click in the note you are now
    # reading puts the caret in it — one click from what Workflowy would have
    # been showing all along. What you see while you are in it is the markdown
    # SOURCE, the same trade the title takes.
    When I open the note of "order"
    Then the description of "order" renders bold text "walnut"
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed holds the source of "order"
    When I type " — measured twice"
    And I click away from the editor
    Then "house.olai" holds a node whose note ends "— measured twice"
    # And clicking away is what it always was: the row folds back to its title.
    # Editing and expanding are ONE state — you leave both at once — and the
    # full rendered note is the node's own page, which is where a note has
    # always been the body.
    And the row "order" is folded

  Scenario: Shift+Enter writes the note, and the rendering comes back
    When I click the title of "handles"
    And I press "Shift+Enter"
    Then the note of "handles" is being typed
    When I type "the alcove is **1830mm** wide"
    And I press "Shift+Enter"
    Then the note of "handles" is no longer being typed
    # `Shift+Enter` writes a note without opening the row's reading of it, so
    # what comes back is the shape the row had before the caret arrived — its
    # title.
    And the row "handles" is folded
    And "house.olai" holds a node whose note ends "wide"
    # ...and once the caret leaves the row entirely, that title has a pilcrow
    # beside it, because there is something behind one at last. Asked AFTER the
    # click away on purpose: while the caret is in the line the title span is
    # an input, and an input has nothing to hang a mark on.
    When I click away from the editor
    Then the node "handles" shows a pilcrow

  Scenario: A write that lands can have something to say
    # The ops layer's nudge — advice on a SUCCESS, never a refusal. It reaches
    # an agent in its tool result; the person who pressed the key is exactly
    # who it is for, so it reaches them too.
    # `mint` is the last unfinished task under `herbs` — which is the moment
    # somebody might want to tick the parent too, and now can.
    Given I open the outline "garden.olai"
    # `mint` is TICKED OFF below and the row has to stay on the page to be
    # read: each page hides its finished work by default now.
    And I show the done nodes
    When I click the title of "mint"
    # Marked BEFORE the key, because the claim is about a line that does not
    # exist yet: the nudge is added to a live region under this row, and ONCE
    # is the whole of it.
    And I mark every element of the row "mint"
    And I press "Control+Enter"
    Then the node "mint" has status "done"
    And the nudge says "every task under"
    # Advice is announced POLITELY — a screen reader finishes the sentence it
    # was reading. It is still announced: a remark nobody is told about is a
    # remark only the sighted reader gets.
    And the nudge is announced politely
    And the row "mint" was read out loud 1 time
    # And it is advice, not a state: the next keystroke takes it away — and a
    # line taken away is silence, not a second announcement.
    When I type "!"
    Then nothing is being said about the row
    And the row "mint" was read out loud 1 time

  Scenario: A refused write keeps the draft and says why
    When I click the title of "handles"
    And I select all and type ""
    And I click away from the editor
    Then the refusal says "a node needs a title"
    # The opposite half of the nudge's manners: a refusal is why nothing
    # happened, so it interrupts. A reader who is not told believes the title
    # they typed was saved.
    And the refusal is announced at once
    And the row being typed holds ""
    And "house.olai" holds a node titled "choose the handles"

  Scenario: A refusal belongs to the row that caused it
    # Two rows and one refusal: clicking away to another title commits the
    # first, and a commit that is REFUSED stops there — the reason is on the
    # row whose text is still unsaved, and the row that was clicked is not
    # opened over the top of it. Before the write queue, the click opened the
    # second row and the refusal landed on it.
    When I click the title of "handles"
    And I select all and type ""
    And I click the title of "knobs"
    Then the refusal says "a node needs a title"
    And the row being typed holds ""
    And "house.olai" holds a node titled "pick the knobs"

  Scenario: Two refusals in a row leave the editor working
    # The blur guard is cleared by a refused key as well as by a frame, so a
    # second refusal cannot latch it — after which the row still commits.
    When I click the title of "handles"
    And I press "Tab"
    Then the refusal says "no row above it"
    When I press "Tab"
    Then the refusal says "no row above it"
    When I select all and type "choose the brass handles"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the brass handles"

  Scenario: The keys keep up with a person typing faster than the wire
    # Every write goes through one queue, so keys pressed without waiting land
    # in the order they were pressed — and each is judged against what the one
    # before it did, rather than against the row as it was two writes ago.
    When I click the title of "knobs"
    And I press "Tab" without waiting
    And I press "Alt+Shift+ArrowUp" without waiting
    And I press "Control+Enter" without waiting
    Then the node "knobs" is a child of "hinges"
    And the node "knobs" has status "done"
    And there should be no page errors

  Scenario: The arrows move the caret between rows
    When I click the title of "handles"
    And I press "ArrowDown"
    Then the row being typed holds "pick the hinges"
    When I press "ArrowUp"
    Then the row being typed holds "choose the handles"

  Scenario: Up and down carry the column, and a shorter line clamps it
    # The vertical keys keep the caret's place in the LINE as they change the
    # ROW — the way a person reads a column of text — and a line shorter than
    # that place takes the caret at the end, not an error or a jump.
    When I click the title of "handles"
    And I put the caret after "choose the handles"
    And I press "ArrowDown"
    Then the row being typed holds "pick the hinges"
    And the caret is at offset 15
    When I press "ArrowDown"
    Then the row being typed holds "pick the knobs"
    And the caret is at offset 14
    When I press "ArrowUp"
    Then the row being typed holds "pick the hinges"
    And the caret is at offset 14

  Scenario: Left at the start and right at the end cross into the line beside
    # A caret sitting at a line's edge has nothing left in THIS line to move
    # through — the arrow hands it to the next line a reader would reach, so
    # the whole outline is one long line of text to the keys.
    When I click the title of "order"
    And I put the caret at the start of the line
    And I press "ArrowLeft"
    Then the row being typed holds "take out the old counters"
    And the caret is at offset 25
    When I press "ArrowRight"
    Then the row being typed holds "order the new cabinets"
    And the caret is at offset 0

  Scenario: The arrows cross a blank draft the way they cross a row
    # A blank on the page is a place the caret can BE: walking down out of the
    # row above must stop on it, not skip it, and walking back up must find the
    # SAME draft again — not a fresh blank each pass.
    When I click the title of "order"
    And I put the caret after "order the new cabinets"
    And I press "Enter"
    Then a new row is being typed
    When I press "ArrowUp"
    Then the row being typed holds "order the new cabinets"
    And a new row is being typed
    When I press "ArrowDown"
    Then a new row is being typed
    When I type "mid sentence"
    And I press "Enter"
    Then "house.olai" holds a node titled "mid sentence"
    And the node titled "mid sentence" comes before the node titled "install"
    When I press "Escape"
    Then there should be no page errors

  Scenario: Enter on a mirror makes a sibling of the PLACEMENT
    # The other half of the mirror rule: what a row SAYS belongs to the node it
    # shows, and where a row SITS belongs to the row. So the new line appears
    # where the reader is looking — in this file, beside the placement — rather
    # than beside the node it stands for, in another one.
    When I click the title of "kitchen-herbs"
    And I press "Enter"
    And I type "and one after the mirror"
    And I click away from the editor
    Then "house.olai" holds a node titled "and one after the mirror"
    And "garden.olai" holds no node titled "and one after the mirror"

  Scenario: A zoomed node with nothing under it offers the first child
    # The other page that has no row to press a key in. The anchor is the node
    # itself rather than a sibling, which is the third of the three places a
    # new row can go.
    When I open the node "knobs"
    And I start the first line
    And I type "brushed steel, maybe"
    And I click away from the editor
    Then "house.olai" holds a node titled "brushed steel, maybe"
    And the tree is shown
    # The `under` anchor's half of the scenario above: a start line is a
    # pending draft too, so the click that commits it is the click that ends
    # it.
    And no row is being edited

  Scenario: An outline that holds nothing offers its first line
    When I rewrite "empty.olai" as:
      """
      """
    And I open the empty outline "empty.olai"
    And I start the first line
    And I type "the first thing"
    And I click away from the editor
    Then "empty.olai" holds a node titled "the first thing"
    # And the `first` anchor's, which is the last of the three.
    And no row is being edited

  Scenario: A skeleton on an empty outline survives the first title
    # StartLine used to unmount the moment the file had a row, taking the
    # parked blanks with it — no title, no Escape, no page close.
    When I rewrite "empty.olai" as:
      """
      """
    And I open the empty outline "empty.olai"
    And I start the first line
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    When I type "the first thing"
    And I press "Enter"
    Then "empty.olai" holds a node titled "the first thing"
    And 3 new rows are being typed

  Scenario: A skeleton under an empty node survives the first title
    When I open the node "knobs"
    And I start the first line
    And I press "Enter"
    And I press "Enter"
    Then 3 new rows are being typed
    When I type "brushed steel"
    And I press "Enter"
    Then "house.olai" holds a node titled "brushed steel"
    And 3 new rows are being typed
