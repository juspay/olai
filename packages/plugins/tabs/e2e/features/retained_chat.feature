@scratch:chat
Feature: A split chat tab keeps its conversation

  Scenario: The split chat page and unsent words survive a tab switch
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    When I ask the agent "hold"
    Then the chat shows a running tool call
    When I unfold the tool call
    And the agent is released
    Then the chat shows a completed tool call
    When I remember pane 1 as "conversation"
    And I type "Save these words for later" into the chat
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I press tab 0
    Then pane 1 is still "conversation"
    And the tool call's detail is shown
    And the composer contains exactly:
      """
      Save these words for later
      """
    And there should be no page errors

  Scenario: A hidden streaming conversation preserves a reader's scroll position
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    When I ask for a tall page answer
    Then the agent is idle
    When I ask the agent "hold"
    And I scroll pane 1 back to its memory
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And the agent is released
    And I press tab 0
    Then the agent is idle
    And pane 1 remains at its saved scroll position
    And there should be no page errors

  @alerts
  Scenario: A question in a hidden mounted conversation still rings
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the notification worker is ready
    When I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I ask the agent "ask later"
    And I press tab 1
    And the agent is released
    Then a notification says "Waiting on your answer"
    And the chime rang
    And tab 0 wears the needs-you dot
    And tab 1 is in front
    When I press tab 0
    Then the chat shows a question
    And there should be no page errors

  Scenario: A hidden conversation resumes following new text on return
    Given I open the outline "house.olai"
    When I alt-click the zoom of "install"
    And I send "hello" from the plain node composer
    Then the node page conversation is ready for "install"
    When I ask for a tall page answer
    Then the agent is idle
    When I ask the agent "hold"
    And I scroll pane 1 to the bottom
    Then pane 1 is at its bottom
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And the agent is released
    And I press tab 0
    Then the agent is idle
    And pane 1 is at its bottom
    And there should be no page errors

  Scenario: A hidden completion does not block keys in the shown conversation
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "look at @pick the hinges" into the chat
    Then the completion offers "hinges"
    When I choose "Open in new tab" from the menu of the outline link "house.olai"
    And I press tab 1
    And I open the "claude" agent on node "install"
    And the node agent's fold is ready
    And I type "also @pick the hinges" into the chat
    Then the completion offers "hinges"
    When I press tab 0
    And I use the fold on node "kitchen"
    Then the completion offers "hinges"
    When I press "ArrowDown" in the chat
    Then the selected chat completion is "hinges"
    When I press "Enter" in the chat
    Then the chat input reads "look at @hinges "
    When I press tab 1
    And I use the fold on node "install"
    Then the chat input reads "also @pick the hinges"
    And there should be no page errors
