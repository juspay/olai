@node-idle-fast @scratch:chat
Feature: Background holds cannot wake chats when their wire reconnects
  Scenario: A live reconnect cannot wake a reaped background conversation from its stale roster
    Given the browser wire can be disconnected
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the "claude" agent on node "install"
    Then the node agent's fold is ready
    And the agent "install" stands "idle"
    When I ask the agent "remember before disconnect"
    Then the agent has answered "remember before disconnect" exactly once
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I mark the page
    And I disconnect the browser wire
    Then the connection is "reconnecting"
    When two node idle deadlines pass
    And I reconnect the browser wire
    Then the connection is "live"
    And tab 1 is in front
    And the agent "install" stands "asleep"
    And the agent "install" remains "asleep" across two idle deadlines
    When I press tab 0
    Then the node agent's fold is ready
    And the agent has answered "remember before disconnect" exactly once
    And the page has not reloaded

