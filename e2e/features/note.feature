Feature: a note folded to one line

  A node's note is drawn one line tall, ellipsized where the text stops, with
  the whole of it still in the page. The note ITSELF is the target: click the
  folded line anywhere and it opens, click the open note anywhere and it folds.
  A click, never a hover — and never a click that was doing something else,
  which is what the last two scenarios are about.

  A note that already fits on one line is not a control at all.

  Scenario: a long note is one line, and says there is more
    When I open the home page
    Then the note under "Ship the server" is folded
    And the note under "Ship the server" offers to open
    And the note under "Ship the server" still says "only the first is on it"

  Scenario: a note that fits on one line offers nothing
    When I open the home page
    Then the note under "Inbox" shows all of it
    And the note under "Inbox" offers nothing to open

  # The whole line, not a control at the end of it: this clicks the note's own
  # text, and the scenario after it clicks the empty part of the line past
  # where the text stops.
  Scenario: clicking the note opens it, and clicking it again folds it
    When I open the home page
    And I click the note under "Ship the server"
    Then the note under "Ship the server" shows all of it
    When I click the note under "Ship the server"
    Then the note under "Ship the server" is folded

  Scenario: the whole folded line is the target, text or not
    When I open the home page
    And I click the end of the folded line under "Ship the server"
    Then the note under "Ship the server" shows all of it

  # Travelling over the outline is not a decision. This is the scenario the
  # hover version failed.
  Scenario: pointing at a note does nothing
    When I open the home page
    And I point at the note under "Ship the server"
    Then the note under "Ship the server" is folded

  # A note is prose, and prose has links in it. The link is on a line the fold
  # hides, so the note is opened first — and following it must leave the note
  # exactly as it was.
  Scenario: a click on a link follows the link, and does not fold the note
    When I open the home page
    And I click the note under "Ship the server"
    And I follow the link inside the note under "Ship the server"
    Then the address ends with "#serve"
    And the note under "Ship the server" shows all of it

  # Copying out of an open note is reading, not folding.
  Scenario: selecting text in an open note does not fold it
    When I open the home page
    And I click the note under "Ship the server"
    And I select some text in the note under "Ship the server"
    Then some text is selected
    And the note under "Ship the server" shows all of it

  @phone
  Scenario: a tap on the note opens it
    When I open the home page
    Then the note under "Ship the server" is folded
    When I click the note under "Ship the server"
    Then the note under "Ship the server" shows all of it

  Scenario: an open note outlives a reload
    When I open the home page
    And I click the note under "Ship the server"
    And I reload the page
    Then the note under "Ship the server" shows all of it

  Scenario: an open note outlives the live view's re-swap
    When I open the home page
    And I click the note under "Ship the server"
    And I mark this page load
    And I add the title "Feed the cat" to the outline
    Then I see the title "Feed the cat"
    And the page has not reloaded
    And the note under "Ship the server" shows all of it

  # The same node at two SITES is two notes, and each is opened on its own —
  # the way the fold is keyed per site.
  Scenario: opening a note leaves its mirror folded
    When I open the home page
    And I click the note under "Ship the server"
    Then the note under "Ship the server" shows all of it
    And the mirrored note under "This week" is folded

  # The pointer has the note to aim at; the keyboard has the button, which is
  # out of sight until it is the thing you have tabbed to.
  Scenario: the keyboard opens the note through a real button
    When I open the home page
    And I focus the note's button under "Ship the server"
    Then the note's button under "Ship the server" is visible
    When I press Enter
    Then the note under "Ship the server" shows all of it
    And the note's button under "Ship the server" says it is expanded
