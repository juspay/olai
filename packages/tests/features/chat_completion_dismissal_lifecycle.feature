@scratch:chat
Feature: Dismissed chat completions stay attached to their draft
  Scenario: Rebuilding the chat preserves a dismissed name and Enter sends the literal text
    Given I open the app
    And the agent panel is open
    And I mark the page
    When I type "discuss @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    Then no completion is open
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the chat input reads "discuss @finishes"
    And no completion is open
    When I press "Enter" in the chat
    Then the chat shows my message "discuss @finishes"
    And the agent's answer mentions "you said: discuss @finishes"
    When I type "read @fin" into the chat
    Then the completion offers "finishes.md"
    When I accept the completion
    And I send the chat message
    Then the agent's answer mentions "you said: read @finishes.md"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Closing the panel retains dismissal while another token can still complete
    Given I open the app
    And the agent panel is open
    When I type "discuss @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    And I close the agent panel
    And the agent panel is open
    Then the chat input reads "discuss @finishes"
    And no completion is open
    When I type "discuss @finishes and @cab" into the chat
    Then the completion offers "notes/cabinets.md"
    When I accept the completion
    And I send the chat message
    Then the agent's answer mentions "you said: discuss @finishes and @notes/cabinets.md"
    And there should be no page errors

  Scenario: Each node chat retains its own dismissal without suppressing another draft
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I type "discuss @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press "Escape" in the chat
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the agent panel is open
    When I type "discuss @finishes" into the chat
    Then the completion offers "finishes.md"
    When I press the agent "install"
    Then the chat input reads "discuss @finishes"
    And no completion is open
    When I press "Enter" in the chat
    Then the agent's answer mentions "you said: discuss @finishes"
    When I press the agent "order"
    Then the chat input reads "discuss @finishes"
    And the completion offers "finishes.md"
    When I accept the completion
    And I send the chat message
    Then the agent's answer mentions "you said: discuss @finishes.md"
    And there should be no page errors
