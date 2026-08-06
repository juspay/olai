Feature: the third state, on the page

  A node between open and done has neither a strikethrough nor, necessarily, a
  date — so it says itself: a pill of its own beside the title, and the state
  on the node. Checking it off is what ends it, and the page finds that out
  the way it finds out about any other write.

  Scenario: a node in flight draws its own pill
    When I open the home page
    Then "Draft the migration plan" is doing
    And "Draft the migration plan" is not done
    And the note under "Draft the migration plan" reads "who is on it lives here, not in the grammar"

  Scenario: an ordinary node is in no state at all
    When I open the home page
    Then "Buy milk" is not doing
    And "Buy milk" is not done
    And "Ship the pitch" is not doing

  Scenario: checking it off from the CLI clears it, live
    When I open the home page
    Then "Draft the migration plan" is doing
    And I mark this page load
    When I check off "Draft the migration plan" from the CLI
    Then "Draft the migration plan" becomes done
    And "Draft the migration plan" is not doing
    And the page has not reloaded
