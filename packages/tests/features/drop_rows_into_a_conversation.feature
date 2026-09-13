@share-scratch @scratch:chat
Feature: Rows land in the conversation chosen by the pointer
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: A drop arms a node and sends its context
    When I carry row "order" over the conversation
    Then the conversation offers "drop to ask about it"
    When I release the carry
    Then the composer is armed with "order"
    And no conversation is lit for a carry
    When I ask the agent "context"
    Then the agent's answer says "order is the node titled order the new cabinets"
    And the message was about "order"

  Scenario: Escape leaves the draft and outline alone
    When I carry row "order" over the conversation
    And I cancel the carry
    Then the composer is armed with nothing
    And no conversation is lit for a carry
