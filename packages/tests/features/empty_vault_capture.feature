@scratch:empty
Feature: Capturing the first thought makes an empty vault useful
  Scenario: The palette creates the first inbox and continues capturing into it
    Given I open the app
    And I mark the page
    When I press the palette shortcut
    And I capture "the first captured thought" from the palette
    Then "_olai/Inbox.olai" holds exactly 1 node titled "the first captured thought"
    And the palette remarks "captured “the first captured thought” to _olai/Inbox.olai"
    When I capture "the second captured thought" from the palette
    Then "_olai/Inbox.olai" holds exactly 1 node titled "the first captured thought"
    And "_olai/Inbox.olai" holds exactly 1 node titled "the second captured thought"
    When I close the palette
    And I open the Inbox from the sidebar
    Then the node titled "the first captured thought" is shown
    And the node titled "the second captured thought" is shown
    And the page has not reloaded
    And there should be no page errors

  @phone
  Scenario: The phone's search button can capture before any file exists
    Given I open the app
    And I mark the page
    Then the phone header is identity and search
    When I tap the header search
    Then the command palette is open
    When I capture "captured from an empty phone vault" from the palette
    Then "_olai/Inbox.olai" holds exactly 1 node titled "captured from an empty phone vault"
    When I close the palette
    And I open the Inbox from the sidebar
    Then the node titled "captured from an empty phone vault" is shown
    And the page has not reloaded
    And there should be no page errors
