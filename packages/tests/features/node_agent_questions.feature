@scratch:chat
Feature: Simultaneous node agents keep their question drafts separate
  Scenario: A draft answer belongs to the node that asked, even when another asks the same fields
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I remember this conversation as "cabinet"
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I type "cabinet answer" into the question's "note" box
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I remember this conversation as "order"
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the question's "note" box still reads ""
    When I type "order answer" into the question's "note" box
    And I press the agent "install"
    Then the panel is in the working conversation "cabinet"
    And the question's "note" box still reads "cabinet answer"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "cabinet answer"
    When I press the agent "order"
    Then the panel is in the working conversation "order"
    And the question's "note" box still reads "order answer"
    When I type "3" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "order answer"
    And there should be no page errors

  Scenario: A question draft survives a closed drawer and an unrelated plugin rebuild
    Given I open the app
    And the agent panel is open
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "retained answer" into the question's "note" box
    And I close the agent panel
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I reopen the agent panel during a turn
    Then the chat shows a question
    And the question's "note" box still reads "retained answer"
    When I type "4" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "retained answer"
    And there should be no page errors

  Scenario: A new harness instance does not inherit an abandoned answer draft
    Given I open the app
    And the agent panel is open
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "abandoned answer" into the question's "note" box
    And I close the agent panel
    And I open the plugins panel
    And I switch the plugin "chat" off
    And I switch the plugin "chat" on
    And I close the plugins panel
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the question's "note" box still reads ""
    When I type "5" into the question's "howMany" box
    And I type "fresh answer" into the question's "note" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "fresh answer"
    And there should be no page errors
