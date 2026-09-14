@scratch:good
Feature: Keyboard directions preserve selection order and anchors
  Scenario: A two-row run moves below its sibling and stays ordered at the bottom
    Given I open the outline "house.olai"
    And I mark the page
    When I pick the title of "handles"
    And I shift-click the title of "hinges"
    Then 2 rows are picked
    When I press "Alt+Shift+ArrowDown"
    Then the node "knobs" comes before "handles"
    And the node "handles" comes before "hinges"
    And the row "handles" is picked
    And the row "hinges" is picked
    When I press "Alt+Shift+ArrowDown"
    Then the node "knobs" comes before "handles"
    And the node "handles" comes before "hinges"
    When I press "ControlOrMeta+z"
    And I press "ControlOrMeta+z"
    Then the node "handles" comes before "hinges"
    And the node "hinges" comes before "knobs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The Mac chord moves a picked run down and both inverses restore it
    Given this browser says it is on a Mac
    And I open the outline "house.olai"
    When I pick the title of "handles"
    And I shift-click the title of "hinges"
    And I press "Meta+Shift+ArrowDown"
    Then the node "knobs" comes before "handles"
    And the node "handles" comes before "hinges"
    When I press "Meta+z"
    And I press "Meta+z"
    Then the node "handles" comes before "hinges"
    And the node "hinges" comes before "knobs"
    And there should be no page errors

  Scenario: Shift-up grows a selection backwards and Shift-down shrinks it toward its anchor
    Given I open the outline "house.olai"
    When I click the title of "knobs"
    And I press "Shift+ArrowUp"
    Then 2 rows are picked
    And the row "hinges" is picked
    And the row "knobs" is picked
    And the row "handles" is not picked
    When I press "Shift+ArrowUp"
    Then 3 rows are picked
    And the row "handles" is picked
    When I press "Shift+ArrowDown"
    Then 2 rows are picked
    And the row "handles" is not picked
    And the row "hinges" is picked
    And the row "knobs" is picked
    When I press "Escape"
    Then no rows are picked
    When I click the title of "handles"
    And I select all and type "editable after shrinking the selection"
    And I click away from the editor
    Then "house.olai" holds a node titled "editable after shrinking the selection"
    And there should be no page errors
