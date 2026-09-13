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
    When I hold the last "agent" transcript row
    And I drag the held finger into the conversation
    And I let the finger go
    Then the composer contains exactly:
      """
      > you said: hello
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
    When I type "before after" into the chat
    And I put the caret after "before " in the chat
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

  Scenario: Another conversation receives the settled answer's source words
    When I ask the agent "hello"
    Then the agent is idle
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I quote the answer from node "kitchen" into this conversation
    Then the composer contains exactly:
      """
      > you said: hello
      """

  Scenario: A tool row carries its title and a diff carries its changed lines
    When I ask the agent "edit notes.md"
    Then the agent is idle
    When I quote the last "tool" row into the conversation
    Then the quote contains "> Edit notes.md"
    When I quote the last diff into the conversation
    Then the quote contains "> -"
    And the quote contains "> +"

  Scenario: Rebuilding chat cancels its held transcript carry
    When I ask the agent "hello"
    Then the agent is idle
    When I carry the last "user" row over the conversation
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I switch the plugin "chat" on
    And I close the plugins panel
    And I use the original browser tab
    And I release the carry
    Then no conversation is lit for a carry
    When I unfold node agent "kitchen"
    And I use the fold on node "kitchen"
    And I quote the last "user" row into the conversation
    Then the composer contains exactly:
      """
      > hello
      """

  Scenario: An answer offers its grip only after it stops streaming
    When I ask the agent "hold"
    Then the chat is streaming an answer
    And the streaming answer has no grip
    When the agent is released
    Then the agent is idle
    When I quote the last "agent" row into the conversation
    Then the quote contains "> "

  Scenario: The remaining lines become the new node's note
    When I send these words to the agent:
      """
      A carried title
      A carried note
      """
    Then the agent is idle
    When I drop the last message above outline row "kitchen"
    Then the outline contains "A carried title"
    And the carried node has the note "A carried note"
    When I press "ControlOrMeta+z"
    Then the outline does not contain "A carried title"
