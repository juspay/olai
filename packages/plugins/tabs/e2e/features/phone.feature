@corpus:good
Feature: Tabs on a phone
  Below the desktop breakpoint there is no strip. The set is kept, and written,
  but not drawn or driven.

  @phone
  Scenario: No strip, and the pane strip still appears for a split
    Given I open the outline "house.olai"
    Then there is no tab strip
    When I alt-click the zoom of "install"
    Then the pane tabs are shown
    And there is no tab strip
    And there should be no page errors

  @phone
  Scenario: The chords do nothing, and Open in new tab shows the page in place
    Given I open the outline "house.olai"
    When I press the "new tab" chord
    Then the address is "/house.olai"
    And the stored tabs hold "/house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then the address is "/garden.olai"
    And the stored tabs hold "/house.olai /garden.olai"
    When I press the "previous tab" chord
    Then the address is "/garden.olai"
    And there should be no page errors

  Scenario: A set stored on a desk is still stored after a phone visit
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then the stored tabs hold "/house.olai /garden.olai"
    When I shrink the window to a phone
    And I open the address "/finishes.md"
    Then there is no tab strip
    And the stored tabs hold "/finishes.md /garden.olai"
    And there should be no page errors
