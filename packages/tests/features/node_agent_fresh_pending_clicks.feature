@scratch:chat
Feature: A pending fresh-session request is one node conversation replacement
  Scenario: Repeated presses while the reply is delayed do not replace the session twice
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I ask the agent "before pending fresh"
    Then the agent has answered "before pending fresh" exactly once
    When I remember this conversation as "original"
    And I mark the page
    And I open the session picker
    And I hold incoming updates to the original browser tab
    And I start a fresh session
    And I open another browser tab
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    And the panel has a different conversation from "original"
    When I remember this conversation as "replacement"
    And I use the original browser tab
    Then the fresh-session request is pending
    And I press the fresh-session button position again
    And I release incoming updates to the original browser tab
    Then the panel is in the remembered conversation "replacement"
    When I ask the agent "after pending fresh"
    Then the agent has answered "after pending fresh" exactly once
    When I open the session picker
    Then the panel says this agent has had 1 past session
    And the past sessions hold "before pending fresh"
    When I start a fresh session
    Then the panel has a different conversation from "replacement"
    When I ask the agent "a later deliberate fresh session"
    Then the agent has answered "a later deliberate fresh session" exactly once
    And the page has not reloaded
    And there should be no page errors
