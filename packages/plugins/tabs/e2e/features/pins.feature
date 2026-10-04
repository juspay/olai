@scratch:good
Feature: A pinned layout follows ordinary link intent
  A plain click opens the layout in place whether tabs are enabled or not.

  Background:
    Given I open the outline "house.olai"

  Scenario: A layout link opens in the current tab
    Given the directory has the pins:
      | [Planning](/s/house.olai/garden.olai) |
    When I follow the pin "/s/house.olai/garden.olai"
    Then there are 1 tabs
    And tab 0 holds "/s/house.olai/garden.olai"
    And there are 2 panes
    And the address is exactly "/s/house.olai/garden.olai"
    When I go back
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
