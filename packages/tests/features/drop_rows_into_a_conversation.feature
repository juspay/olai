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

  Scenario: Picked rows keep their order and a chip can be removed
    When I pick the title of "install"
    And I pick the title of "order"
    And I drop row "install" into the conversation
    Then the composer is armed with "install"
    And the composer is armed with "order"
    When I take the armed node "install" off
    Then the composer is armed with "order"

  @phone
  Scenario: A held bullet lands as context on a phone
    When I hold a finger on the bullet of "order" and keep it there
    And I drag the held finger into the conversation
    And I let the finger go
    Then the composer is armed with "order"
    And no conversation is lit for a carry

  Scenario: Rebuilding the carrier cancels the old gesture
    When I carry row "order" over the conversation
    And I open another browser tab
    And I open the plugins panel
    And I switch the plugin "outlines" off
    And I switch the plugin "outlines" on
    And I close the plugins panel
    And I use the original browser tab
    And I release the carry
    Then no conversation is lit for a carry
    When I use the fold on node "kitchen"
    Then the composer is armed with nothing
    When I drop row "order" into the conversation
    Then the composer is armed with "order"

  Scenario: The row menu offers starting a conversation and context uses the drop
    When I open the node menu of "order"
    Then the node menu offers "Start an agent session"
    And the node menu does not offer "Ask agent"

  Scenario: Leaving the conversation restores the outline drop line
    When I carry row "order" over the conversation
    And I carry the row away from the conversation above "install"
    Then no conversation is lit for a carry
    And the drop line would put it under "demo"
    When I cancel the carry
    Then the composer is armed with nothing

  Scenario: Rows can cross files into a zoomed conversation
    Given I rewrite "carried.olai" as:
      """
      {"id":"carried-source","ord":"a0","title":"a node from another file"}
      """
    When I open the address "/s/carried.olai/%23kitchen?f=1"
    Then the node page conversation is ready for "kitchen"
    And I drop row "carried-source" from pane 0 into the conversation
    Then the composer is armed with "carried-source"

  Scenario: Withdrawing the destination makes the held release harmless
    When I carry row "order" over the conversation
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
    Then the composer is armed with nothing
    When I drop row "order" into the conversation
    Then the composer is armed with "order"
