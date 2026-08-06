Feature: the outline, drawn

  The home page draws the outline the server was pointed at: what each node
  says, what it is tagged, when it is due, whether it is done, and where a
  mirror stands in for a node defined elsewhere.

  Scenario: every part of a node reaches the page
    When I open the home page
    Then I see the title "Buy milk"
    And the note under "Inbox" reads "Quick capture landing zone"
    And "Inbox" carries the tag "#capture"
    And "Buy milk" carries the date "2026-01-15"
    And "Ship the pitch" is done
    And "Buy milk" is not done

  Scenario: a mirror site draws the node it mirrors
    When I open the home page
    Then "This week" holds a mirror of "serve"
    And the mirror under "This week" draws "Ship the server"

  Scenario: the sidebar tree lists the outline's top level
    When I open the home page
    Then the sidebar lists "Inbox"
    And the sidebar lists "Ship the server"
    And the sidebar lists "This week"
