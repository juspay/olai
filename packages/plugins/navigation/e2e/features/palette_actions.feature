@share-scratch
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
  first use, at `_olai/Inbox.olai` — where olai puts the files it names
  itself), and the box empties for the next one.

  `@scratch:` because they write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: On an outline there is nothing to write about, so nothing is offered
    When I press the palette shortcut
    Then the palette offers "Go to today"
    And the palette does not offer "Mark: To do"
    And the palette does not offer "Move to Trash"

  Scenario: Zoomed, the palette offers what that node can take
    Given I open the node "kitchen"
    When I press the palette shortcut
    Then the palette offers "Mark: To do"
    And the palette offers "Mark: Done"
    And the palette offers "Mark: Clear"
    And the palette offers "Move to Trash"
    And the palette does not offer "Mark: Doing"
    And the palette does not offer "Clear date"

  Scenario: The verbs that ask something first are not in it — all three of them
    Given I open the node "kitchen"
    When I press the palette shortcut
    Then the palette does not offer "Set date…"
    And the palette does not offer "Link to a node…"
    And the palette does not offer "Wait for a node…"

  Scenario: An untouched palette has nothing chosen, so Enter writes nothing
    Given I open the node "kitchen"
    When I press the palette shortcut
    And I press "Enter"
    Then the command palette is open
    And "house.olai" holds a node marked doing titled "kitchen remodel #home"
    When I move the palette cursor to "Mark: To do"
    And I press "Enter"
    Then "house.olai" holds a node marked todo titled "kitchen remodel #home"

  Scenario: Marking from the palette writes the mark, and the page follows the file
    Given I open the node "handles"
    And I mark the page
    When I press the palette shortcut
    And I choose "Mark: Doing" from the palette
    Then the command palette is closed
    And "house.olai" holds a node marked doing titled "choose the handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Typing the node's own title finds what can be done to it
    Given I open the node "handles"
    When I press the palette shortcut
    And I type "handles" into the palette
    Then the palette offers "Mark: Done"

  Scenario: A refusal is quoted where it was asked, and the palette stays up
    Given I open the node "demo"
    When I press the palette shortcut
    And I choose "Mark: Doing" from the palette
    Then the palette says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the command palette is open
    And the node "demo" has status "done"

  Scenario: A write that landed with something to say says it here too
    Given I open the node "mint"
    When I press the palette shortcut
    And I choose "Mark: Done" from the palette
    Then the palette remarks "every task under `the herb bed by the door` is done now"
    And "garden.olai" holds a node marked done titled "split the mint"

  Scenario: Clearing a date from the palette removes the field
    Given I open the node "order"
    When I press the palette shortcut
    And I choose "Clear date" from the palette
    Then "house.olai" holds the node "order" with no date

  Scenario: The put-away asks first, in the palette's own box
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: The question takes the caret, and Tab stays inside the modal
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    Then the palette's caret is on "go"
    When I press "Tab"
    Then the palette's caret is on "cancel"
    Then Tab walks the palette and comes back to "go"
    When I press "Escape"
    Then the palette is not asking anything
    And the command palette is open
    And "house.olai" holds a node titled "install the cabinets"

  Scenario: A prefix typed behind the question does not steal its Enter
    Given I open the node "install"
    When I press the palette shortcut
    And I choose "Move to Trash" from the palette
    And I click the palette box
    And I type "+ oops" into the palette
    And I press "Enter"
    Then "house.olai" no longer holds the node "install"
    And "_olai/Inbox.olai" holds exactly 0 nodes titled "oops"

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
    And "_olai/Trash.olai" holds the node "install"
    And "_olai/Trash.olai" holds the node "hinges"
    And there should be no page errors

  Scenario: ⌘Z takes back an op chosen from the palette
    Given I open the node "handles"
    When I press the palette shortcut
    And I choose "Mark: Doing" from the palette
    Then the command palette is closed
    And "house.olai" holds a node marked doing titled "choose the handles"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" with no mark

  Scenario: The capture row is a command like any other, and it primes the prefix
    When I press the palette shortcut
    And I type "inbox" into the palette
    Then the palette offers "Capture to the Inbox"
    When I choose "Capture to the Inbox" from the palette
    Then the command palette is open
    And the palette box holds "+ "

  Scenario: The line about to become a node is previewed, so Enter is never a guess
    When I press the palette shortcut
    And I type "+ buy the walnut stain" into the palette
    Then the palette previews the capture "Capture to the Inbox: buy the walnut stain"

  Scenario: A capture mints the inbox on first use and lands the line in it
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    And the palette remarks "Captured “buy the walnut stain” to _olai/Inbox.olai"
    And there should be no page errors

  Scenario: A second Enter on the first capture is not a second write
    When I press the palette shortcut
    And I type "+ buy the walnut stain" into the palette
    And I press "Enter" twice without waiting
    Then the palette remarks "Captured “buy the walnut stain” to _olai/Inbox.olai"
    And "_olai/Inbox.olai" holds exactly 1 node titled "buy the walnut stain"
    And there should be no page errors

  Scenario: A capture of nothing is refused in the ops layer's own words
    When I press the palette shortcut
    And I capture "   " from the palette
    Then the palette says "a node needs a title"
    And the command palette is open
    And the palette box holds "+    "

  Scenario: Nothing moves, and the box is ready for the next line
    Given I open the node "install"
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then the command palette is open
    And the palette box holds "+ "
    And the address is "/zoom/#install"
    When I capture "and a tin of oil" from the palette
    Then "_olai/Inbox.olai" holds a node titled "and a tin of oil"
    And "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    Then the zoomed node is "install"

  Scenario: A second capture goes into the inbox that now exists
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I capture "and a tin of oil" from the palette
    Then "_olai/Inbox.olai" holds a node titled "and a tin of oil"
    And there should be no page errors

  Scenario: ⌘Z takes back a capture
    When I press the palette shortcut
    And I capture "buy the walnut stain" from the palette
    Then the palette remarks "Captured “buy the walnut stain” to _olai/Inbox.olai"
    And "_olai/Inbox.olai" holds a node titled "buy the walnut stain"
    When I close the palette
    And I press "ControlOrMeta+z"
    Then "_olai/Inbox.olai" no longer holds a node titled "buy the walnut stain"
