@scratch:good
Feature: The ⌘K palette writes
  The palette could go places and ask the agent; it could not change anything.
  Two halves close that, and both of them are one op through the same write
  gate a keystroke and the ••• menu go through — nothing here is a shortcut
  past the ops layer, and nothing is echoed onto the page.

  OP ROWS are the ••• menu's own verbs, offered against the node the reader has
  ZOOMED. That node was, until now, the one node in the app no pointer could
  mark, date or put away: the menu hangs off a ROW, and a zoom is a page.

  QUICK CAPTURE is racket's `olai add` — a `+` prefix, a line, Enter — and its
  whole promise is that nothing moves. The page, the scroll and the address
  stay where they were, the line lands in the directory's inbox (minted on
  first use, at the root), and the box empties for the next one.

  `@scratch:` because they write the directory they are served — each scenario
  gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: On an outline there is nothing to write about, so nothing is offered
    # A command list is read out of context. A write aimed at whatever row
    # happened to be hovered is a write nobody can predict, so the rows are
    # simply absent until the address says which node the reader is looking at.
    When I press the palette shortcut
    Then the palette offers "Go to today"
    And the palette does not offer "Mark todo"
    And the palette does not offer "Move to Trash"

  Scenario: Zoomed, the palette offers what that node can take
    # `kitchen` is doing, has no date, and is a node rather than a placement —
    # so no `Mark doing` (it carries one), no `Clear date`, no `Remove this
    # placement`.
    Given I open the node "kitchen"
    When I press the palette shortcut
    Then the palette offers "Mark todo"
    And the palette offers "Complete"
    And the palette offers "Clear mark"
    And the palette offers "Move to Trash"
    And the palette does not offer "Mark doing"
    And the palette does not offer "Clear date"

  Scenario: The verbs that ask something first are not in it — all three of them
    # A different reason for an absence, and it is one reason rather than three:
    # each of these opens a PANEL that hangs off a row, and the palette is drawn
    # OVER the tree rather than in it. `Set date…` was the only one when the op
    # rows landed; the two edge verbs joined it, and a scenario that pinned the
    # first alone would go on passing the day a fourth arrived unexcluded.
    # A zoomed node reaches all three from its own controls instead
    # (`edge_editing.feature`, `setting_a_date.feature`).
    Given I open the node "kitchen"
    When I press the palette shortcut
    Then the palette does not offer "Set date…"
    And the palette does not offer "Link to a node…"
    And the palette does not offer "Wait for a node…"

  Scenario: An untouched palette has nothing chosen, so Enter writes nothing
    # What lets the op rows sit FIRST — where a reader can see them — without a
    # stray keypress meaning `Mark todo`. A highlight is where the arrows start
    # from, not a choice somebody made; the first character typed is the choice.
    Given I open the node "kitchen"
    When I press the palette shortcut
    And I press "Enter"
    Then the command palette is open
    And "house.olai" holds a node marked doing titled "kitchen remodel #home"
    # …and the arrows are the way in: down lands on the first row, which is the
    # first thing this node can take.
    When I press "ArrowDown"
    And I press "Enter"
    Then "house.olai" holds a node marked todo titled "kitchen remodel #home"

  Scenario: Every op row says which node it is about
    # The palette is opened from anywhere, so a bare `Complete` in a list of
    # strangers does not say what it would complete. The subject goes on the
    # second line, in the slot a search hit puts its ancestry in.
    Given I open the node "install"
    When I press the palette shortcut
    Then the palette row "Complete" is about "on “install the cabinets”"

  Scenario: Marking from the palette writes the mark, and the page follows the file
    Given I open the node "handles"
    # Marked AFTER the zoom: opening a node is a real navigation, and what this
    # scenario claims is that the WRITE re-rendered in place.
    And I mark the page
    When I press the palette shortcut
    And I choose "Mark doing" from the palette
    Then the command palette is closed
    And "house.olai" holds a node marked doing titled "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Typing the node's own title finds what can be done to it
    Given I open the node "handles"
    When I press the palette shortcut
    And I type "handles" into the palette
    Then the palette offers "Complete"

  Scenario: A refusal is quoted where it was asked, and the palette stays up
    # The ops layer's own words, verbatim — nothing decides on somebody's
    # behalf that finished work is not finished — and a modal that closed on
    # top of them would be exactly the silent failure HACKING.md forbids. Two
    # presses is what an agent makes and what the ••• menu asks for.
    Given I open the node "demo"
    When I press the palette shortcut
    And I choose "Mark doing" from the palette
    Then the palette says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the command palette is open
    And the node "demo" has status "done"

  Scenario: A write that landed with something to say says it here too
    # The rollup's nudge reaches the person who caused the write, in the other
    # mood — which is what `data-tone` is for. `install` is ticked off over two
    # tasks nobody finished.
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Complete" from the palette
    Then the palette remarks "is done over 2 unfinished tasks"
    And "house.olai" holds a node marked done titled "install the cabinets"

  Scenario: Clearing a date from the palette removes the field
    Given I open the node "order"
    When I press the palette shortcut
    And I choose "Clear date" from the palette
    Then "house.olai" holds the node "order" with no date

  Scenario: The put-away asks first, in the palette's own box
    # The ••• menu's sentence, verbatim — the same blast radius, counted over
    # the SET — because a reader who has agreed to it once has agreed to this.
    # A `window.confirm` would be browser chrome olai does not own.
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette asks "Move “install the cabinets” and the 3 rows under it to the Trash? They keep their ids, and the Trash in the sidebar is where to put them back."
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: The question takes the caret, and Tab cycles its two ways out
    # A question nobody's keyboard can reach is a question only a mouse may
    # answer — and the palette's own Tab trap made that literal, because it
    # sent every Tab back to the box. While the question stands, the trap is
    # the QUESTION's (review, 2026-08-14).
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette's caret is on "go"
    When I press "Tab"
    Then the palette's caret is on "cancel"
    When I press "Tab"
    Then the palette's caret is on "go"
    # …and the way out by keyboard is still Escape, which cancels the question
    # rather than the palette.
    When I press "Escape"
    Then the palette is not asking anything
    And the command palette is open
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: A prefix typed behind the question does not steal its Enter
    # The Switch draws the question above both prefixes because nothing typed
    # next may quietly become the answer. Enter has to keep the same promise:
    # it answers what is on screen, not what is in a box somebody clicked back
    # into (review, 2026-08-14).
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    And I click the palette box
    And I type "+ oops" into the palette
    And I press "Enter"
    Then "house.olai" no longer holds the node "install"
    And "Inbox.olai" holds exactly 0 nodes titled "oops"

  Scenario: Cancelling the question writes nothing
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    And I choose "Cancel" from the palette
    Then the palette is not asking anything
    And the palette offers "Move to Trash"
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: Answering it moves the subtree to the Trash, ids and all
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    And I choose "Move to Trash" from the palette
    Then "house.olai" no longer holds the node "install"
    And "Archive.olai" holds the node "install"
    And "Archive.olai" holds the node "hinges"
    And there should be no page errors

  Scenario: ⌘Z takes back an op chosen from the palette
    # One undo stack, whichever hand made the edit: the palette records what
    # the server said would take its write back, exactly as a keystroke and a
    # ••• entry do.
    Given I open the node "handles"
    When I press the palette shortcut
    And I choose "Mark doing" from the palette
    # The CLOSE rather than the disk: the palette shuts in the same answer that
    # files the inverse, so it is the signal that there is something on the
    # stack. The file can be written a beat before that answer reaches the tab.
    Then the command palette is closed
    And "house.olai" holds a node marked doing titled "choose the handles"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" with no mark

  # ── quick capture ────────────────────────────────────────────────────

  Scenario: The capture row is a command like any other, and it primes the prefix
    # A prefix nobody has been told about is a feature nobody finds, so the
    # gesture is listed. Choosing it types the `+` and leaves the palette up:
    # there is no line yet, and nothing to write.
    When I press the palette shortcut
    And I type "inbox" into the palette
    Then the palette offers "Capture to the Inbox"
    When I choose "Capture to the Inbox" from the palette
    Then the command palette is open
    And the palette box holds "+ "

  Scenario: The line about to become a node is previewed, so Enter is never a guess
    When I press the palette shortcut
    And I type "+ buy the walnut stain" into the palette
    Then the palette previews the capture "capture to the Inbox: buy the walnut stain"

  Scenario: A capture mints the inbox on first use and lands the line in it
    # The directory has no inbox, so the write is a `create` seeded with this
    # very title — ONE op, so a refused seed would leave no file behind. What
    # it says afterwards NAMES THE FILE, and that name comes back on the
    # answer: only the server knows which outline the inbox is, so a sentence
    # the browser composed would be the one claim it may not make.
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "Inbox.olai" holds a node titled "buy the walnut stain"
    And the palette remarks "captured “buy the walnut stain” to Inbox.olai"
    And there should be no page errors

  Scenario: A second Enter on the first capture is not a second write
    # THE BLOCKING FINDING (review, 2026-08-14). The capture keeps the box and
    # the palette, so nothing visible has happened while the round trip is out
    # — which is exactly when a hand repeats the key. Both sends are judged
    # against a reading the first has not landed in yet, so on a directory
    # with no inbox both resolve to the same `create Inbox.olai`, the write
    # gate re-plans that REQUEST rather than re-resolving the edit, and the
    # second comes back refused in `create_outline`'s own words — over a line
    # that DID land, with the refusal overwriting the remark saying so.
    #
    # So: one write at a time, the date picker's rule. The remark below is the
    # assertion that matters twice over — it proves the first landed AND that
    # no refusal overwrote it.
    When I press the palette shortcut
    And I type "+ buy the walnut stain" into the palette
    And I press "Enter" without waiting
    And I press "Enter" without waiting
    Then the palette remarks "captured “buy the walnut stain” to Inbox.olai"
    And "Inbox.olai" holds exactly 1 node titled "buy the walnut stain"
    And there should be no page errors

  Scenario: A capture of nothing is refused in the ops layer's own words
    # No fence on this face: the resolver sends a blank title verbatim, so what
    # comes back is the sentence an agent's `add_node` gets — and an Enter that
    # did nothing and said nothing would be exactly the silent failure this
    # slot exists to prevent. The line stays in the box to be fixed.
    When I press the palette shortcut
    And I capture "   " from the palette
    Then the palette says "a node needs a title"
    And the command palette is open
    And the palette box holds "+    "

  Scenario: Nothing moves, and the box is ready for the next line
    # The whole promise of quick capture: the page under the palette is the
    # page it was, the address has not changed, and a second thought can be
    # typed without reaching for the chord again.
    Given I open the node "install"
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then the command palette is open
    And the palette box holds "+ "
    And the address is "/n/install"
    When I capture "and a tin of oil" from the palette
    Then "Inbox.olai" holds a node titled "and a tin of oil"
    And "Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    Then the zoomed node is "install"

  Scenario: A second capture goes into the inbox that now exists
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "Inbox.olai" holds a node titled "buy the walnut stain"
    When I capture "and a tin of oil" from the palette
    Then "Inbox.olai" holds a node titled "and a tin of oil"
    And there should be no page errors

  Scenario: ⌘Z takes back a capture
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    # The palette's own line rather than the disk, for the reason the op
    # scenario gives: it is said in the answer that files the inverse.
    Then the palette remarks "captured “buy the walnut stain” to Inbox.olai"
    And "Inbox.olai" holds a node titled "buy the walnut stain"
    # The palette first: ⌘Z is dead while the box has the caret, because an
    # input has the platform's own undo in it — the same rule a draft follows.
    When I close the palette
    And I press "ControlOrMeta+z"
    Then "Inbox.olai" no longer holds a node titled "buy the walnut stain"
