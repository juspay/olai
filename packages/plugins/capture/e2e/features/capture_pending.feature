@scratch:good
Feature: Capture responses preserve what the reader typed next
  Scenario: A completed capture does not clear the next thought
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "+ first thought" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I type "+ second thought" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the palette box holds "+ second thought"
    And the palette remarks "captured “first thought” to _olai/Inbox.olai"
    When I press "Enter"
    Then "_olai/Inbox.olai" holds exactly 1 node titled "first thought"
    And "_olai/Inbox.olai" holds exactly 1 node titled "second thought"
    And there should be no page errors

  Scenario: A capture response does not change a reopened palette
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "+ first thought" into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I press "Escape" without waiting
    Then the command palette is closed
    When I press "ControlOrMeta+k" without waiting
    And I type "garden" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the palette box holds "garden"
    And the palette has no write response
    And "_olai/Inbox.olai" holds exactly 1 node titled "first thought"
    And there should be no page errors

  Scenario: A late refusal does not label the corrected capture as invalid
    Given incoming updates to this browser tab can be held
    And I open the outline "house.olai"
    When I press the palette shortcut
    And I type "+ " into the palette
    And I hold incoming updates to the original browser tab
    And I press "Enter" without waiting
    And I type "+ corrected thought" into the palette
    And I release incoming updates to the original browser tab
    And I wait for the palette write to finish
    Then the palette box holds "+ corrected thought"
    And the palette has no write response
    When I press "Enter"
    Then "_olai/Inbox.olai" holds exactly 1 node titled "corrected thought"
    And there should be no page errors
