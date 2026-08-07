Feature: a note folded to one line

  A node's note is drawn one line tall, with the whole of it still in the page.
  The "…" beside it opens it and folds it again — a click, never a hover: a
  note that answered the pointer moved the page under the cursor, and crossing
  the outline opened whatever was on the way.

  A note that already fits on one line carries no "…" at all: there is nothing
  to open, and nothing says there is.

  Scenario: a long note is one line, and says there is more
    When I open the home page
    Then the note under "Ship the server" is folded
    And the note under "Ship the server" offers to open
    And the note under "Ship the server" still says "only the first is on it"

  Scenario: a note that fits on one line offers nothing
    When I open the home page
    Then the note under "Inbox" shows all of it
    And the note under "Inbox" offers nothing to open

  Scenario: the button opens the note, and folds it again
    When I open the home page
    And I open the note under "Ship the server"
    Then the note under "Ship the server" shows all of it
    When I fold the note under "Ship the server"
    Then the note under "Ship the server" is folded

  # Travelling over the outline is not a decision. This is the scenario the
  # hover version failed.
  Scenario: pointing at a note does nothing
    When I open the home page
    And I point at the note under "Ship the server"
    Then the note under "Ship the server" is folded

  @phone
  Scenario: the button is a target for a finger
    When I open the home page
    Then the note under "Ship the server" is folded
    When I tap the note's button under "Ship the server"
    Then the note under "Ship the server" shows all of it

  Scenario: an open note outlives a reload
    When I open the home page
    And I open the note under "Ship the server"
    And I reload the page
    Then the note under "Ship the server" shows all of it

  Scenario: an open note outlives the live view's re-swap
    When I open the home page
    And I open the note under "Ship the server"
    And I mark this page load
    And I add the title "Feed the cat" to the outline
    Then I see the title "Feed the cat"
    And the page has not reloaded
    And the note under "Ship the server" shows all of it

  # The same node at two SITES is two notes, and each is opened on its own —
  # the way the fold is keyed per site.
  Scenario: opening a note leaves its mirror folded
    When I open the home page
    And I open the note under "Ship the server"
    Then the note under "Ship the server" shows all of it
    And the mirrored note under "This week" is folded
