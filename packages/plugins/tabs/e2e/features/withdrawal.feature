@scratch:good
Feature: Switching the tabs row off and on
  Off takes the strip away and leaves the page in front where it is, and Back
  walks the window's whole history again. On brings the stored set back.

  Scenario: The strip goes, the window's history returns, and the set comes back
    Given I open the outline "house.olai"
    And I mark the page
    When I click the outline "garden.olai"
    And I press the new tab button
    And I click the document "finishes.md"
    Then there are 2 tabs
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then there is no tab strip
    And the main-column reserve equals the visible chrome
    And the address is "/finishes.md"
    When I go back
    Then the address is "/"
    When I go back
    Then the address is "/house.olai"
    When I open the plugins panel
    And I switch the plugin "tabs" on
    And I close the plugins panel
    Then there are 2 tabs
    And the main-column reserve equals the visible chrome
    And tab 1 is in front
    And tab 0 holds "/garden.olai"
    And tab 1 holds "/house.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: With the tabs off, the bar keeps its height and a section pins under it
    Given I open the outline "house.olai"
    And I show the done nodes
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then there is no tab strip
    And the app header wears its own height
    And nothing stands between the app header and the page
    When the window is shorter than the page
    And I read the outline with Notes on "open"
    And I scroll to the end of the outline
    Then the section heading of "kitchen" is pinned under the main-column chrome
    And the main-column reserve equals the visible chrome
    And there should be no page errors
