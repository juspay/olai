@corpus:good
Feature: Tabs retain their pages
  A visited tab owns its mounted pages until it closes. A saved tab starts its
  pages only when it is first shown.

  Scenario: Switching tabs preserves the page and closing it releases it
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    Then there are 1 live lanes
    When I press tab 1
    Then there are 2 live lanes
    And remembered pane "house" is mounted
    When I press tab 0
    Then pane 0 is still "house"
    When I close tab 0 with its button
    Then remembered pane "house" is removed
    And there are 1 live lanes
    And there should be no page errors

  Scenario: Splitting and closing a neighbour preserves the original page
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    Then there are 2 panes
    And pane 0 is still "house"
    When I close the focused pane
    Then there are 1 panes
    And pane 0 is still "house"
    And there should be no page errors

  Scenario: A retained pane survives a rail and both sides of the breakpoint
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    And I collapse pane 0 by dragging its divider
    Then a pane rail is shown for pane 0
    And remembered pane "house" is mounted
    When I expand the pane rail 0
    Then pane 0 is still "house"
    When I shrink the window to a phone
    Then there are 1 live lanes
    And remembered pane "house" is mounted
    When I tap pane tab 0
    Then pane 0 is still "house"
    When I widen the window to a desk
    Then pane 0 is still "house"
    And there should be no page errors

  Scenario: Reload restores saved addresses without opening background pages
    Given I open the outline "house.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then there are 2 live lanes
    When I reload the page
    Then there are 1 live lanes
    And tab 1 is in front
    When I press tab 0
    Then there are 2 live lanes
    And there should be no page errors

  Scenario: A filter belongs to the retained tab
    Given I open the outline "house.olai"
    When I filter the page by "kitchen"
    And I remember pane 0 as "filtered"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    And I press tab 0
    Then the filter box holds "kitchen"
    And pane 0 is still "filtered"
    And there should be no page errors

  Scenario: With the tabs row off only the current lane remains
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then there are 2 live lanes
    When I open the plugins panel
    And I switch the plugin "tabs" off
    And I close the plugins panel
    Then there are 1 live lanes
    And remembered pane "house" is removed
    And there should be no page errors

  Scenario: Reordering moves the existing page to its new position
    Given I open the outline "house.olai"
    When I remember pane 0 as "house"
    And I alt-click the zoom of "install"
    And I drag pane header 0 to pane header 1
    Then pane 1 is still "house"
    And there should be no page errors

  @scratch:good
  Scenario: Window scroll survives switching away from a lone page
    Given an outline and a taller document for scroll history
    And I open the outline "scroll-history.olai"
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I scroll to the bottom of the page
    And I press tab 1
    And I press tab 0
    Then the page is at the bottom
    And there should be no page errors

  @scratch:good
  Scenario: A hidden selection ignores another tab's bulk keys
    Given I open the outline "house.olai"
    And I show the done nodes
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I pick the title of "handles"
    And I pick the title of "knobs"
    Then 2 rows are picked
    When I press tab 1
    And I press "Escape"
    And I press tab 0
    Then 2 rows are picked
    And the row "handles" is picked
    And the row "knobs" is picked
    And there should be no page errors

  @scratch:good
  Scenario: Two tabs share edits while a finished-row reveal stays in its own pane
    Given I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    Then the node "basil" is not shown
    When I click the title of "mint"
    And I select all and type "mint shared between tabs"
    And I press "Enter"
    And I press "Escape"
    And I press tab 0
    Then the node "mint" has the title "mint shared between tabs"
    And the node "basil" is shown
    And this page's Done flip says "hidden"
    When I press tab 1
    Then the node "basil" is not shown
    And there should be no page errors

  Scenario: A phone adopts the front page and releases other live lanes
    Given I open the outline "house.olai"
    When I remember pane 0 as "background"
    And I choose "Open in new tab" from the menu of the outline link "garden.olai"
    And I press tab 1
    And I remember pane 0 as "front"
    Then there are 2 live lanes
    When I shrink the window to a phone
    Then there are 1 live lanes
    And pane 0 is still "front"
    And remembered pane "background" is removed
    When I widen the window to a desk
    Then pane 0 is still "front"
    And there are 1 live lanes
    And there should be no page errors

  @scratch:good
  Scenario: A split column keeps a nonzero scroll position across tab switches
    Given an outline and a taller document for scroll history
    And I open the address "/s/scroll-history.olai/garden.olai"
    Then the node "scroll-row-39" is shown
    When I leave pane 0 halfway down
    And I choose "Open in new tab" from the menu of the outline link "house.olai"
    And I press tab 1
    And I press tab 0
    Then pane 0 keeps its nonzero scroll position
    And there should be no page errors
