@scratch:chat
Feature: A send during node session replacement stays with its original conversation
  Scenario: A delayed browser refuses an old-session send and recovers its draft in history
    Given incoming updates to this browser tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I ask the agent "before replacement"
    Then the agent has answered "before replacement" exactly once
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
    And I ask the agent "draft sent during replacement"
    And I release incoming updates to the original browser tab
    Then the panel is in the remembered conversation "replacement"
    And the panel refuses, saying "the conversation changed; this action was not applied"
    And the chat input reads ""
    When I open the session picker
    And I open the past session "before replacement"
    Then the panel is in the remembered conversation "original"
    And the chat input reads "draft sent during replacement"
    When I send the chat message
    Then the agent has answered "draft sent during replacement" exactly once
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "replacement"
    When I ask the agent "replacement remains usable"
    Then the agent has answered "replacement remains usable" exactly once
    And the page has not reloaded
    And there should be no page errors
