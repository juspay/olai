@scratch:good
Feature: Browser history restores positions across outline and document rendering
  Background:
    Given an outline and a taller document for scroll history
    And the window is shorter than the page

  Scenario: Back from a taller document restores the outline position
    Given I open the outline "scroll-history.olai"
    And I mark the page
    When I scroll to the bottom of the page
    And I click the document "scroll-history.md"
    Then the page is at the top
    When I go back
    Then the node "scroll-row-39" is shown
    And the page is back where I left it
    When I go forward
    Then the page is at the top
    And the page has not reloaded
    And there should be no page errors

  Scenario: Forward from an outline restores the taller document position
    Given I open the outline "scroll-history.olai"
    And I mark the page
    When I click the document "scroll-history.md"
    And I scroll to the bottom of the page
    And I go back
    Then the node "scroll-row-0" is shown
    And the page is at the top
    When I go forward
    Then the page is back where I left it
    And the page has not reloaded
    And there should be no page errors

  Scenario: A shorter outline clamps restoration and remembers the reader returning to its top
    Given I open the outline "scroll-history.olai"
    And I mark the page
    When I scroll to the bottom of the page
    And I click the document "scroll-history.md"
    And I shorten the scroll history outline to 10 rows
    And I go back
    Then the node "scroll-row-9" is shown
    And the page is at the bottom
    When I wheel to the top of the reading pane
    Then the page is at the top
    When I go forward
    And I go back
    Then the node "scroll-row-0" is shown
    And the page is at the top
    When I click the title of "scroll-row-0"
    And I select all and type "edited after shorter history"
    And I click away from the editor
    Then "scroll-history.olai" holds a node titled "edited after shorter history"
    And the page has not reloaded
    And there should be no page errors

  @pane-title
  Scenario: A split outline keeps its title while its middle scrolls independently
    Given I open the outline "scroll-history.olai"
    When I alt-click the zoom of "scroll-row-0"
    Then there are 2 panes
    When I scroll pane 0 to its middle
    Then pane 0 keeps its title "scroll-history.olai" above its scroller
    And pane 1 keeps its title "scroll-row-0" above its scroller
    And the split workspace stays within the window
