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

  THE THREE DOORS that take a row this way are the chat composer's `@` list,
  the shortlist every node-picking panel is built from, and the row editor's
  own three widgets. One of them is here; the other two say it where their own
  feature already lives — `edge_editing.feature` for the shortlist,
  `input_widgets.feature` for the `((` list in a row's title.

  IT WAS FIVE, and the two that went are the two search doors: the ⌘K palette's
  node hits and the header's box, deleted with the ruling that left this app one
  search box (docs/brainstorming/one-search-box.md). Every row the palette draws
  now is matched in this tab off a list it already holds, so there is no answer
  behind one to be inside the settle of — which the scenario below asserts
  rather than assumes, because "no row here is ever behind" is exactly the kind
  of claim a later change makes untrue quietly.

  `@corpus:` rather than `@scratch:`: nothing here writes the directory. Two of
  the doors NAVIGATE and the third writes into a message box, so what a wrong
  row spends is an address and a sentence.

  Scenario: The palette's rows are not gated by anything, because nothing is behind them
    # The reason the freshness is a fact about a ROW rather than about a door,
    # kept now that this list has one kind of row again: every row the palette
    # draws is matched in this tab off a list it already holds, so `Enter` on
    # one inside the settle of some OTHER box runs it — which is the palette's
    # oldest gesture and the one a reader makes fastest.
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I retype the palette as "agenda" and press Enter at once
    Then the address is "/agenda"
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
