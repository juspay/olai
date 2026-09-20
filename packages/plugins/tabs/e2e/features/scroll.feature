@scratch:good
Feature: A tab keeps its place
  A page in a tab that goes to the background is left where it was scrolled,
  and comes back there.

  Background:
    Given an outline and a taller document for scroll history
    And the window is shorter than the page

  Scenario: The scroll position returns when a tab comes back to the front
    Given I open the outline "scroll-history.olai"
    And I mark the page
    When I scroll to the bottom of the page
    Then the page is at the bottom
    And the tab strip is pinned below the app header
    When I press the new tab button
    Then the page is at the top
    When I press tab 0
    Then the node "scroll-row-39" is shown
    And the page is back where I left it
    And the page has not reloaded
    And there should be no page errors

  Scenario: A long document keeps another tab reachable at the bottom
    Given I open the document "scroll-history.md"
    When I press the new tab button
    And I press tab 0
    And I scroll to the bottom of the page
    Then the page is at the bottom
    And the tab strip is pinned below the app header
    When I press tab 1
    Then tab 1 is in front
    And the address is "/"
    And there should be no page errors
