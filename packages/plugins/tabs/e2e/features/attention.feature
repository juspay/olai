@scratch:chat
Feature: A tab whose conversation needs you wears a dot
  A dot on the tab, and nothing more: no tab comes forward because of it.

  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: The dot goes on that conversation's tab only, and answering takes it away
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I ask the agent "ask"
    Then the chat shows a question
    And the agent "kitchen" stands "needs-you"
    And tab 0 wears the needs-you dot
    And tab 1 wears no dot
    And tab 0 is in front
    When I press tab 1
    Then tab 0 wears the needs-you dot
    And tab 1 is in front
    When I press tab 0
    And I choose "birch"
    And I answer the question
    Then the question has been answered
    And tab 0 wears no dot
    And tab 0 is in front
    And there should be no page errors
