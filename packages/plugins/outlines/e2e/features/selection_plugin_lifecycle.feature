@scratch:good
Feature: A selection belongs to the open page through plugin rebuilds
  Background:
    Given I open the outline "house.olai"
    And I mark the page
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    Then 2 rows are picked
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent

  Scenario: A retained selection indents exactly its two rows and can be outdented
    Then 2 rows are picked
    And the row "hinges" is picked
    And the row "knobs" is picked
    And the row "handles" is not picked
    When I press "Tab"
    Then the node "hinges" is a child of "handles"
    And the node "knobs" is a child of "handles"
    When I press "Shift+Tab"
    Then the node "hinges" is a child of "install"
    And the node "knobs" is a child of "install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Explicit navigation clears a retained selection before returning to the outline
    Then 2 rows are picked
    When I click the outline "garden.olai"
    Then no rows are picked
    When I click the outline "house.olai"
    Then no rows are picked
    When I pick the title of "handles"
    Then 1 rows are picked
    And the row "hinges" is not picked
    And the row "knobs" is not picked
    When I press "Escape"
    Then no rows are picked
    And the page has not reloaded
    And there should be no page errors

  Scenario: Extending the retained range uses its original anchor
    Then 2 rows are picked
    When I shift-click the title of "handles"
    Then 2 rows are picked
    And the row "handles" is picked
    And the row "hinges" is picked
    And the row "knobs" is not picked
    When I press "Escape"
    Then no rows are picked
    And the page has not reloaded
    And there should be no page errors
