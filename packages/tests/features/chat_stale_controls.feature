@scratch:chat
Feature: A delayed tab cannot apply a chat control to another node's turn
  Scenario: Cancel from an outdated tab refuses instead of stopping the newly selected node
    Given incoming updates to this chat tab can be held
    And the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I hold incoming updates to the original chat tab
    And I open another chat tab
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent is working
    When I use the original chat tab
    And I cancel the turn
    And I release incoming updates to the original chat tab
    Then the panel refuses, saying "the conversation changed"
    When I use the other chat tab
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    When I press the agent "install"
    Then the agent is working
    When I cancel the turn
    Then the agent is idle
    And there should be no page errors
