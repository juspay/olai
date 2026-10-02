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
