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

  @phone
  Scenario: Holding a message lifts its words on a phone
    When I ask the agent "hello"
    Then the agent is idle
    When I hold the last "user" transcript row
    And I drag the held finger into the conversation
    And I let the finger go
    Then the composer contains exactly:
      """
      > hello
      """

  Scenario: A message dropped into an outline is one undoable node
    When I ask the agent "a carried sentence"
    Then the agent is idle
    When I drop the last message above outline row "kitchen"
    Then the outline contains "a carried sentence"
    When I press "ControlOrMeta+z"
    Then the outline does not contain "a carried sentence"

  Scenario: A quote is inserted at the caret with both sides of the sentence intact
    When I ask the agent "hello"
    Then the agent is idle
    When I prepare the draft "before after" with its caret at 7
    And I quote the last "user" row into the conversation
    Then the composer contains exactly:
      """
      before > hello

      after
      """
    And the caret in the chat box is at 16

  Scenario: Cancelling a transcript carry and a grip click preserve the draft
    When I ask the agent "hello"
    Then the agent is idle
    When I carry the last "user" row over the conversation
    And I cancel the carry
    Then no conversation is lit for a carry
    When I press the last transcript grip without travelling
    Then the composer contains exactly:
      """
      """

  @phone
  Scenario: A flick over a transcript is not a quote
    When I ask the agent "hello"
    Then the agent is idle
    When I flick the last transcript row
    Then no conversation is lit for a carry
    And the composer contains exactly:
      """
      """
