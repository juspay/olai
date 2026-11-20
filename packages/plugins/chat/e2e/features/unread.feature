@scratch:chat
Feature: The conversations you have not read yet
  An agent that answers while nobody is looking at its conversation goes on
  saying so: its row in the sidebar is drawn bold and marked, and a tab holding
  that conversation wears a quieter dot than the one for a question. Looking at
  it takes both away — in every tab at once, and across a reload — and a turn
  that finishes in front of you is read as it lands.

  Nothing rings for either. A turn merely FINISHING is silent on purpose, and
  the mark is bookkeeping about a person's attention rather than a request, so
  no chime, no system notification and no icon mark come of one.

  What "looking at it" means is chat's own answer, shared with the alerts: the
  conversation is the page in FRONT of this window, in a document the browser is
  showing. A folded conversation, a tab behind another tab and a window behind
  an editor are all the same thing here.

  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the notification worker is ready

  @scratch:chat @alerts @wire
  Scenario: An answer that arrives behind a closed fold is unread, and opening it reads it
    When I ask the agent "hold"
    And I mark the wire
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    And the Chats row "kitchen" says it is unread
    And the Chats row "kitchen" wears the "Idle" dot
    And the tab has not marked the conversation as read
    And no chime rang
    And no notification has been raised
    When I mark the wire
    And I unfold node agent "kitchen"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread

  @scratch:chat @alerts @wire
  Scenario: A tab holding that conversation wears the quieter dot while you are elsewhere
    When I ask the agent "hold"
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I mark the wire
    And the agent is released
    Then the Chats row "kitchen" is unread
    And tab 0 wears the unread dot
    And the tab has not marked the conversation as read
    When I mark the wire
    And I press tab 0
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And tab 0 wears no dot

  @scratch:chat @alerts @wire
  Scenario: Another tab reading the conversation reads it for this one
    When I ask the agent "hold"
    And I open node "kitchen" in another tab
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And there are 3 tabs
    And I press tab 1
    And I mark the wire
    And the agent is released
    Then the Chats row "kitchen" is unread
    And tab 0 wears the unread dot
    And the tab has not marked the conversation as read
    When I mark the wire
    And I press tab 2
    Then the node page conversation is ready for "kitchen"
    And the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And tab 0 wears no dot

  @scratch:chat @alerts @wire
  Scenario: What you have read stays read after a reload
    When I ask the agent "hold"
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    When I mark the wire
    And I unfold node agent "kitchen"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    When I reload the page
    Then the Chats row "kitchen" is not unread

  @scratch:chat @alerts @wire
  Scenario: What you have NOT read is still unread after a reload
    When I ask the agent "hold"
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    When I mark the wire
    And I reload the page
    Then the Chats row "kitchen" is unread
    And the tab has not marked the conversation as read

  @scratch:chat @alerts @wire
  Scenario: An answer that arrives in front of you is read as it lands
    When I mark the wire
    And I ask the agent "hold"
    And the agent is released
    And the agent's answer says "and done"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And no chime rang
    And no notification has been raised
