@scratch:chat
Feature: A plugin command cannot close a newer palette interaction
  Scenario: A delayed chat command leaves a reopened search palette alone
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    And the agent panel is open
    When I press the palette shortcut
    And I type "> hello from the palette" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I press "Escape" without waiting
    Then the command palette is closed
    When I press "ControlOrMeta+k" without waiting
    And I type "garden" into the palette
    And I release incoming updates to the original browser tab
    Then the agent's answer mentions "you said: hello from the palette"
    And the command palette is open
    And the palette box holds "garden"
    And there should be no page errors
