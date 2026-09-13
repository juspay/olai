@share-scratch @scratch:chat
Feature: A sidebar file becomes a path in the message
  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: A file drop names the path without opening the file
    When I drop sidebar file "house.olai" into the conversation
    Then the composer contains exactly:
      """
      @house.olai
      """
    And the composer is armed with nothing
    And no conversation is lit for a carry
