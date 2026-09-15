@corpus:good
Feature: Back and Forward stay inside the tab in front
  The browser keeps one history for the window. Back and Forward walk only the
  pages of the tab in front; bringing a tab forward is not a step, and closing
  one drops its pages.

  Scenario: Back in a tab lands on that tab's own page, not another tab's
    Given I open the outline "house.olai"
    And I mark the page
    When I click the outline "garden.olai"
    And I click the document "finishes.md"
    And I press the new tab button
    And I click the outline "house.olai"
    Then the address is "/house.olai"
    When I go back
    Then the address is "/"
    And there are 2 tabs
    And tab 1 is in front
    And the page has not reloaded
    And there should be no page errors

  Scenario: Back at the start of a tab's history stays on that tab, and Forward then works within it
    Given I open the outline "house.olai"
    And I mark the page
    When I press the new tab button
    And I click the outline "garden.olai"
    And I go back
    Then the address is "/"
    When I go back
    Then the address is "/"
    And tab 1 is in front
    When I go forward
    Then the address is "/garden.olai"
    And tab 1 is in front
    And the page has not reloaded
    And there should be no page errors

  Scenario: Back walks past the pages of a tab that was closed
    Given I open the outline "house.olai"
    And I mark the page
    When I click the outline "garden.olai"
    And I press the new tab button
    And I click the document "finishes.md"
    And I press tab 0
    And I close tab 1 with its button
    And I go back
    Then the address is "/house.olai"
    And there is 1 tab
    And the page has not reloaded
    And there should be no page errors

  Scenario: A reload brings the set back with every tab's history empty
    Given I open the outline "house.olai"
    When I click the outline "garden.olai"
    And I choose "Open in new tab" from the menu of the outline link "house.olai"
    And I reload the page
    Then the tabs hold "/garden.olai /house.olai"
    And tab 0 is in front
    When I mark the page
    And I go back
    Then the address is "/garden.olai"
    And there are 2 tabs
    And the page has not reloaded
    And there should be no page errors
