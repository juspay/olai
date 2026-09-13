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

  @phone
  Scenario: A held file closes the drawer and lands in the visible conversation
    When I tap the burger
    And I hold sidebar file "house.olai"
    Then the sidebar is put away
    When I drag the held finger into the conversation
    And I let the finger go
    Then the composer contains exactly:
      """
      @house.olai
      """

  Scenario: A path is written at the caret and remains message text
    When I prepare the draft "read carefully" with its caret at 5
    And I drop sidebar file "house.olai" into the conversation
    Then the composer contains exactly:
      """
      read @house.olai carefully
      """
    And the caret in the chat box is at 17
    And the composer is armed with nothing
