Feature: a note folded to one line

  A node's note is drawn one line tall, ellipsized, with the whole of it still
  in the page: pointing at the node opens it, and pointing away folds it back.
  The fold is a box, not a shorter string, so nothing a reader could search for
  is missing while it is folded.

  A note that already fits on one line has nothing to open, and shows nothing
  saying it has.

  Scenario: a long note is one line until you point at the node
    When I open the home page
    Then the note under "Ship the server" is folded to one line
    And the note under "Ship the server" still says "only the first is on it"
    When I point at "Ship the server"
    Then the note under "Ship the server" shows all of it
    When I point away
    Then the note under "Ship the server" is folded to one line

  # A node opens its OWN note. Were it the whole subtree's, pointing at a leaf
  # would open every note above it at once — the page moving under the cursor
  # to say something about nodes it is nowhere near.
  Scenario: pointing at a child does not open its parent's note
    When I open the home page
    And I point at "Write the tests"
    Then the note under "Ship the server" is folded to one line

  Scenario: a note that fits on one line has nothing to open
    When I open the home page
    Then the note under "Inbox" shows all of it
    And the note under "Inbox" is one line tall

  # The note is focusable, so a tap is what opens it where there is no pointer
  # to hover with. The pointer is taken off the note afterwards: on a desktop
  # browser the click hovers it too, and hover is the mechanism this scenario
  # is not about.
  @phone
  Scenario: a tap opens the note where there is no hover
    When I open the home page
    Then the note under "Ship the server" is folded to one line
    When I tap the note under "Ship the server"
    And I point away
    Then the note under "Ship the server" shows all of it

  Scenario: an open note is still open after the live view re-swaps it
    When I open the home page
    And I tap the note under "Ship the server"
    And I point away
    And I mark this page load
    And I add the title "Feed the cat" to the outline
    Then I see the title "Feed the cat"
    And the page has not reloaded
    And the note under "Ship the server" shows all of it
