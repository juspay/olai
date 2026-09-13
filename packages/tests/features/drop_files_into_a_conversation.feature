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

  Scenario: File carries preserve navigation and folder rows are not handles
    Given I rewrite "carry-folder/note.md" as:
      """
      A carried file.
      """
    When I try carrying sidebar folder "carry-folder" into the conversation
    Then no conversation is lit for a carry
    And the composer contains exactly:
      """
      """
    When I expand the folder "carry-folder"
    And I drop sidebar file "carry-folder/note.md" into the conversation
    Then the composer contains exactly:
      """
      @carry-folder/note.md
      """
    And the address still contains "/house.olai"
    When I click sidebar file "carry-folder/note.md"
    Then the address still contains "/carry-folder/note.md"

  Scenario: A document page does not offer a landing for a sidebar file
    Given I rewrite "carry-document.md" as:
      """
      A document.
      """
    When I open the address "/s/carry-document.md/%23kitchen?f=1"
    Then the node page conversation is ready for "kitchen"
    When I carry sidebar file "house.olai" over the conversation
    And I aim the carry at pane 0
    Then no conversation is lit for a carry
    And no drop line is shown
    When I release the carry
    Then the composer contains exactly:
      """
      """
