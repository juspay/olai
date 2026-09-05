@scratch:chat
Feature: A node history count follows session creation in another tab
  Scenario: A fresh session elsewhere updates the history count before anybody sends a message
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I ask the agent "first session in live history"
    Then the agent has answered "first session in live history" exactly once
    When I remember this conversation as "first"
    And I mark the page
    And I open the session picker
    And I open another browser tab
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I remember this conversation as "second"
    And I use the original browser tab
    Then the panel is in the remembered conversation "second"
    And the node session control counts 2 conversations
    And the roster offers no unassigned chats
    When I open the session picker
    Then the panel says this agent has had 1 past session
    And the past sessions hold "first session in live history"
    When I open the past session "first session in live history"
    Then the panel is in the remembered conversation "first"
    When I ask the agent "continued from the updated history"
    Then the agent has answered "continued from the updated history" exactly once
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "second"
    When I ask the agent "second remains usable"
    Then the agent has answered "second remains usable" exactly once
    And the page has not reloaded
    And there should be no page errors
