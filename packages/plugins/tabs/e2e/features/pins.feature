@scratch:good
Feature: A pinned layout opens as a tab
  With the tabs row on, a pinned layout on the shelf opens in a new tab in
  front. With it off, the same press opens the layout in place.

  Background:
    Given I open the outline "house.olai"

  Scenario: Pressing a pinned layout opens it in a new tab
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I follow the pin "/s/house.olai/garden.olai"
    Then there are 2 tabs
    And tab 1 is in front
    And tab 1 holds "/s/house.olai/garden.olai"
    And tab 0 holds "/house.olai"
    And there are 2 panes
    And the address is exactly "/s/house.olai/garden.olai"
    When I press tab 0
    Then there are 1 panes
    And the address is exactly "/house.olai"
    And there should be no page errors

  Scenario: With the tabs row off, the same press opens in place
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then there is no tab strip
    When I follow the pin "/s/house.olai/garden.olai"
    Then there are 2 panes
    And the address is exactly "/s/house.olai/garden.olai"
    When I go back
    Then the address is exactly "/house.olai"
    And there are 1 panes
    And there should be no page errors
