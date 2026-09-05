@scratch:good
Feature: Appearance state and its preferences UI have independent lifetimes
  Scenario: Appearance follows storage while the preferences UI is absent
    Given I open the app
    And I mark the page
    When I pick the theme "pitch"
    And I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "preferences" off
    Then the preferences plugin has no rendered controls
    When another tab stores theme "reef", font "system", and size "medium"
    Then the page is in the theme "reef"
    And the page is in the font "system"
    And the page is set at "16px"
    When I switch the plugin "preferences" on
    And I close the plugins panel
    And I open the preferences
    Then the lit theme chip is "reef"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Removing appearance releases observers and returning rereads stored choices
    Given I open the app
    And I mark the page
    When I pick the theme "pitch"
    And I pick the font "system"
    And I set Size to "larger"
    And I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "theme" off
    Then the appearance attributes have been released
    When another tab stores theme "reef", font "system", and size "medium"
    Then the appearance attributes have been released
    When I close the plugins panel
    And I open the preferences
    Then the preferences have no appearance controls
    And the preferences retain their Notes control
    When I press Escape on the preferences
    And I open the plugins panel
    And I switch the plugin "theme" on
    Then the page is in the theme "reef"
    And the page is in the font "system"
    And the page is set at "16px"
    When I close the plugins panel
    And I open the preferences
    Then the lit theme chip is "reef"
    And the page has not reloaded
    And there should be no page errors
