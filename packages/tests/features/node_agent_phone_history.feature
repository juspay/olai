@phone @scratch:chat
Feature: Node chat history remains usable through the phone sheet
  Scenario: A phone can revisit history, create a third chat from it, and return after reloading
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I hold a finger on the node "install"
    Then the node menu is open
    When I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    When I ask the agent "phone cabinet first"
    Then the agent has answered "phone cabinet first" exactly once
    When I remember this conversation as "first"
    And I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    When I ask the agent "phone cabinet second"
    Then the agent has answered "phone cabinet second" exactly once
    When I remember this conversation as "second"
    And I open the session picker
    Then the panel says this agent has had 1 past session
    When I open the past session "phone cabinet first"
    Then the panel is in the remembered conversation "first"
    When I open the session picker
    And I start a fresh session
    Then the panel has a different conversation from "first"
    And the panel has a different conversation from "second"
    And the panel header names the node agent "install the cabinets"
    When I ask the agent "phone cabinet third"
    Then the agent has answered "phone cabinet third" exactly once
    When I remember this conversation as "third"
    And I reload the page
    Then the panel header names the node agent "install the cabinets"
    And the panel is in the remembered conversation "third"
    When I open the session picker
    Then the panel says this agent has had 2 past sessions
    When I open the past session "phone cabinet second"
    Then the panel is in the remembered conversation "second"
    And the agent has answered "phone cabinet second" exactly once
    When I open the session picker
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "third"
    And the agent has answered "phone cabinet third" exactly once
    And there should be no page errors

  Scenario: Two phone node chats keep their drafts separate when opened through the sidebar
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I hold a finger on the node "install"
    Then the node menu is open
    When I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    When I type "unsent cabinet thought" into the chat
    And I tap the chat sheet scrim
    And I hold a finger on the node "order"
    Then the node menu is open
    When I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the chat input reads ""
    When I ask the agent "phone order thought"
    Then the agent has answered "phone order thought" exactly once
    When I tap the chat sheet scrim
    And I press the agent "install"
    Then the panel header names the node agent "install the cabinets"
    And the chat input reads "unsent cabinet thought"
    When I send the chat message
    Then the agent has answered "unsent cabinet thought" exactly once
    When I tap the chat sheet scrim
    And I press the agent "order"
    Then the panel header names the node agent "order the new cabinets"
    And the chat input reads ""
    And the agent has answered "phone order thought" exactly once
    And there should be no page errors
