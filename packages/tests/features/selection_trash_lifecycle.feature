@scratch:good
Feature: A rebuilt bulk Trash action asks again and remains recoverable
  Scenario: Retained rows need a fresh confirmation and can both be put back
    Given I open the outline "house.olai"
    And I mark the page
    When I pick the title of "hinges"
    And I pick the title of "knobs"
    Then 2 rows are picked
    When I press the Trash
    Then the question names "2 rows"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And 2 rows are picked
    And the pick is not asking anything
    And "house.olai" holds the node "hinges"
    And "house.olai" holds the node "knobs"
    When I press the Trash
    Then the question names "2 rows"
    When I press the Trash
    Then the node "hinges" is not shown
    And the node "knobs" is not shown
    And the node "handles" is shown
    And "_olai/Trash.olai" holds the node "hinges"
    And "_olai/Trash.olai" holds the node "knobs"
    When I open the Trash
    And I put back "hinges" from the Trash
    And I put back "knobs" from the Trash
    Then "house.olai" holds the node "hinges"
    And "house.olai" holds the node "knobs"
    When I click the outline "house.olai"
    Then no rows are picked
    And the node "hinges" is a child of "install"
    And the node "knobs" is a child of "install"
    When I click the title of "hinges"
    And I select all and type "restored after bulk Trash"
    And I press "Enter"
    And I press "Escape"
    Then "house.olai" holds a node titled "restored after bulk Trash"
    And the page has not reloaded
    And there should be no page errors
