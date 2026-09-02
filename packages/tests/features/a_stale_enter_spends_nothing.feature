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
    Given I open the outline "house.org"
    When I press the palette shortcut
    And I type "compost" into the palette
    Then the palette lists the node "the compost heap"
    When I retype the palette as "mint" and press Enter at once
    # Nothing was opened, and the modal is still up over the page it was
    # opened from.
    Then the address is "/house.org"
    And the command palette is open
    # Waited out whole: by the time the rows answer the new query, anything
    # that key wrongly sent has landed and the address would say so.
    And the palette lists the node "split the mint"
    And the address is "/house.org"
    # ...and the key is not lost to the reader, only to the wrong row: pressed
    # again over rows that are theirs, it opens the one they were looking at.
    When I press "Enter"
    Then the address is "/#mint"
    And there should be no page errors

  Scenario: A pointer opens the row it pressed, inside the same window
    # The other hand, and the half a key scenario cannot pin. The gate lives on
    # the KEY at every door and never inside the take itself, so a press in the
    # window the scenario above opens takes the row it landed on — which is the
    # row somebody could see. Moving the gate one level down would keep every
    # other scenario in this file green.
    Given I open the outline "house.org"
    When I press the palette shortcut
    And I type "compost" into the palette
    Then the palette lists the node "the compost heap"
    When I retype the palette as "mint" and press the node row "compost" at once
    Then the address is "/#compost"
    And there should be no page errors

  Scenario: The palette's own rows are not gated by a search behind them
    # The half a whole-door gate would get wrong, and the reason the freshness
    # is a fact about a ROW. This list is TWO blocks: the commands are matched
    # in this tab off a list it already holds, and the hits are a debounce and
    # a round trip away. A command row is never behind anything, so `Enter` on
    # one inside the settle runs it — which is the palette's oldest gesture and
    # the one a reader makes fastest.
    Given I open the outline "house.org"
    When I press the palette shortcut
    And I retype the palette as "agenda" and press Enter at once
    Then the address is "/agenda"
    And there should be no page errors

  Scenario: The header box opens nothing for a row the query has moved past
    Given I open the outline "house.org"
    When I search the header for "compost"
    Then the header search lists the node "the compost heap"
    When I retype the header search as "mint" and press Enter at once
    Then the address is "/house.org"
    And the header search lists the node "split the mint"
    And the address is "/house.org"
    When I press "Enter"
    Then the address is "/#mint"
    And there should be no page errors

  Scenario: The @ list writes nothing for a row the word has moved past
    # What this door spends is not an address but somebody's sentence: a node
    # taken off the list writes `@its-id ` into the message AND arms the node,
    # so a stale row put a handle the reader never chose under a message they
    # were still typing.
    Given I open the app
    And the agent panel is open
    When I type "look at @mint" into the chat
    Then the completion offers "mint"
    When I retype the chat as "look at @heap" and press Enter at once
    Then the chat input reads "look at @heap"
    And the composer is armed with nothing
    # ...and the rows catch up: `heap` is in the compost heap's title and in no
    # file's name, so the list that arrives is the reader's own.
    And the completion offers "compost"
    And the chat input reads "look at @heap"
    When I press "Enter"
    Then the chat input reads "look at @compost "
    And the composer is armed with "compost"
    # ...and this list's OTHER block is never behind anything, which is the
    # palette scenario's argument at the door where it matters most: the served
    # paths are matched in this tab, and `@cab` + Enter has written a path
    # since the `@` list existed.
    When I retype the chat as "read @finish" and press Enter at once
    Then the chat input reads "read @finishes.md "
    And there should be no page errors
