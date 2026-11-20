@corpus:good
Feature: A stale Enter is claimed and spends nothing
  Every shortlist in this client is a box, a question the server answers, and a
  cursor `Enter` takes a row under. The rows HOLD STILL through the 200ms
  settle and the round trip after it — what a reader is looking at stays until
  the next answer arrives, which is the only honest thing to *draw*
  (`client/settled.ts`) and the wrong thing to *write from*. So there is a
  window, after every keystroke, in which `Enter` means a row of a question the
  reader has already typed past.

  What it may not do there is spend. The key is CLAIMED all the same — a list
  is on screen under the reader's hands, and an `Enter` falling past it would
  do something else entirely — and nothing is dimmed while it waits: a whole
  list going grey and back on every keystroke is a flicker, in a client whose
  whole campaign was about flicker. The rows catch up a moment later and the
  same press means what it says.

  A POINTER is never gated, at any door: a hand is on the row it can SEE, and
  taking that row is exactly what the hand asked for however far the box has
  moved on. Only the key means "the row under the cursor", and the cursor's row
  is the one about to change underneath it. That half has a scenario of its own
  below, because the way it breaks is a later change moving the gate inside the
  take — which no key scenario here would notice.

  The five doors that take a row this way are the ⌘K palette, the header's
  search box, the chat composer's `@` list, the shortlist every node-picking
  panel is built from, and the row editor's own three widgets. Three of them
  are here; the other two say it where their own feature already lives —
  `edge_editing.feature` for the shortlist, `input_widgets.feature` for the
  `((` list in a row's title.

  `@corpus:` rather than `@scratch:`: nothing here writes the directory. Two of
  the doors NAVIGATE and the third writes into a message box, so what a wrong
  row spends is an address and a sentence.

  Scenario: The palette opens nothing for a row the query has moved past
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "compost" into the palette
    Then the palette lists the node "the compost heap"
    When I retype the palette as "mint" and press Enter at once
    Then the address is "/house.olai"
    And the command palette is open
    And the palette lists the node "split the mint"
    And the address is "/house.olai"
    When I press "Enter"
    Then the unified destination row "mint" is selected
    And there should be no page errors

  Scenario: A pointer opens the row it pressed, inside the same window
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "compost" into the palette
    Then the palette lists the node "the compost heap"
    When I retype the palette as "mint" and press the node row "compost" at once
    Then the unified destination row "compost" is selected
    And there should be no page errors

  Scenario: The palette's own rows are not gated by a search behind them
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I retype the palette as "agenda" and press Enter at once
    Then the address is "/agenda"
    And there should be no page errors

  Scenario: The header box opens nothing for a row the query has moved past
    Given I open the outline "house.olai"
    When I search the header for "compost"
    Then the header search lists the node "the compost heap"
    And the header search box asks for a Go key and no corrections
    When I retype the header search as "mint" and press Enter at once
    Then the address is "/house.olai"
    And the header search lists the node "split the mint"
    And the address is "/house.olai"
    When I press "Enter"
    Then the unified destination row "mint" is selected
    And there should be no page errors

  Scenario: The @ list writes nothing for a row the word has moved past
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "look at @mint" into the chat
    Then the completion offers "mint"
    When I retype the chat as "look at @heap" and press Enter at once
    Then the chat input reads "look at @heap"
    And the composer is armed with nothing
    And the completion offers "compost"
    And the chat input reads "look at @heap"
    When I press "Enter"
    Then the chat input reads "look at @compost "
    And the composer is armed with "compost"
    When I retype the chat as "read @finish" and press Enter at once
    Then the chat input reads "read @finishes.md "
    And there should be no page errors
