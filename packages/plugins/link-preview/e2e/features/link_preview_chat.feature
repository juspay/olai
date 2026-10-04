@scratch:chat
Feature: Chat links share live previews
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: Agent code references preview a node without changing their click action
    When I ask the agent "done order"
    Then the agent's answer names the node "order"
    When I hover the chat preview reference "order"
    Then the link preview contains "order the new cabinets"
    When I press the node "order" in the answer
    Then the node "order" is focused
    And the address is "/house.olai"
    And there should be no page errors

  Scenario: Conversation links preview the last two turns without a composer
    When I ask the agent "context"
    Then the agent's answer says "no node in context"
    When I hover the conversation preview link "kitchen"
    Then the link preview contains "Chat"
    And the link preview contains "no node in context"
    And the link preview does not contain "Start an agent"
    And there should be no page errors
