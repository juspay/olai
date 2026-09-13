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
    When I ask the agent "hello again"
    Then the agent is idle
    When I hold the last "agent" transcript row
    And I drag the held finger into the conversation
    And I let the finger go
    Then the composer contains exactly:
      """
      > you said: hello again
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
    And I put the caret after "before" in the chat
    And I quote the last "user" row into the conversation
    Then the composer contains exactly:
      """
      before
      > hello

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
    When I ask the agent "hello again"
    Then the agent is idle
    When I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I quote the answer from node "kitchen" into this conversation
    Then the composer contains exactly:
      """
      > you said: hello again
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
      > what did we decide?
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

  Scenario: A transcript can create a node in the other pane's outline
    When I ask the agent "A sentence across panes"
    Then the agent is idle
    When I open the address "/s/house.olai/%23kitchen?f=1"
    Then the node page conversation is ready for "kitchen"
    When I drop the message from pane 1 above row "order" in pane 0
    Then the outline contains "A sentence across panes"
    When I press "ControlOrMeta+z"
    Then the outline does not contain "A sentence across panes"

  Scenario: Two views of one conversation focus the receiving composer
    When I ask the agent "hello"
    Then the agent is idle
    When I open the address "/s/%23kitchen/%23kitchen?f=0"
    When I quote the message from pane 1 into pane 0
    Then no conversation is lit for a carry

  Scenario: A document page does not offer a landing for transcript words
    Given I rewrite "carry-document.md" as:
      """
      A document, not an outline.
      """
    When I ask the agent "hello"
    Then the agent is idle
    When I open the address "/s/carry-document.md/%23kitchen?f=1"
    Then the node page conversation is ready for "kitchen"
    When I carry the last "user" row over the conversation
    And I aim the carry at pane 0
    Then no conversation is lit for a carry
    And no drop line is shown
    When I release the carry
    Then the composer contains exactly:
      """
      """

  Scenario: Rebuilding an outline receiver clears its held drop line
    When I ask the agent "A cancelled addition"
    Then the agent is idle
    When I carry the last message above outline row "kitchen"
    Then the drop line would put it first
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "outlines" off
    And I switch the plugin "outlines" on
    And I close the plugins panel
    And I use the original browser tab
    Then no drop line is shown
    When I release the carry
    Then the outline does not contain "A cancelled addition"
    When I use the fold on node "kitchen"
    And I drop the last message above outline row "kitchen"
    Then the outline contains "A cancelled addition"

  Scenario: Deleting the indicated parent refuses the addition rather than moving it
    Given I rewrite "carry-target.olai" as:
      """
      {"id":"carry-parent","ord":"a0","title":"Destination"}
      {"id":"carry-child","parent":"carry-parent","ord":"a0","title":"Child"}
      """
    When I ask the agent "A refused addition"
    Then the agent is idle
    When I open the address "/s/carry-target.olai/%23kitchen?f=1"
    Then the node page conversation is ready for "kitchen"
    When I carry the last message above outline row "carry-child"
    Then the drop line would put it under "carry-parent"
    When I rewrite "carry-target.olai" as:
      """
      {"id":"carry-child","ord":"a0","title":"Child"}
      """
    Then the node "carry-parent" is not shown
    When I release the carry
    Then the carry refusal names "carry-parent"
    And the outline does not contain "A refused addition"

  @phone
  Scenario: A streaming row also keeps the enclosing outline menu closed
    When I ask the agent "hold"
    Then the chat is streaming an answer
    When I hold the last "agent" transcript row
    Then the node menu is closed
    And no conversation is lit for a carry
    When I let the finger go
    And the agent is released
    Then the agent is idle
