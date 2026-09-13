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
    When I type "read carefully" into the chat
    And I put the caret after "read " in the chat
    And I drop sidebar file "house.olai" into the conversation
    Then the composer contains exactly:
      """
      read @house.olai carefully
      """
    And the caret in the chat box is at 17
    And the composer is armed with nothing

  Scenario: Escape cancels a path and an outline gap refuses it without a drop line
    When I carry sidebar file "house.olai" over the conversation
    And I cancel the carry
    Then no conversation is lit for a carry
    And the composer contains exactly:
      """
      """
    When I carry sidebar file "house.olai" over the conversation
    And I carry the row away from the conversation above "install"
    Then no conversation is lit for a carry
    And no drop line is shown
    When I release the carry
    Then the composer contains exactly:
      """
      """
