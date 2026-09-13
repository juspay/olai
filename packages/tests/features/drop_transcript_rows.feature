@share-scratch @scratch:chat
Feature: A transcript row carries its source words
  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: A person's message can be quoted back into its own conversation
    When I ask the agent "hello"
    Then the agent's answer says "hello"
    When I quote the last "user" row into the conversation
    Then the composer contains exactly:
      """
      > hello
      """
    And no conversation is lit for a carry
