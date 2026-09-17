@corpus:lanes
Feature: Session bindings are edited on the node page
  Scenario: Placement hides the session chip while other kinds keep their chips
    Given I open the outline "lanes.olai"
    Then the node "door-live" shows no property "agent-session"
    And the node "door-implement" shows no property "agent-session"
    And the node "door-implement" shows the property "terminal" holding "11111111"
    And the node "lane-door" shows the property "repo" holding "olai"
    When I zoom into the node "door-live"
    Then the node "door-live" shows the property "agent-session" holding "claude:fake-session-1"
    And the property "agent-session" on "door-live" is not folded
