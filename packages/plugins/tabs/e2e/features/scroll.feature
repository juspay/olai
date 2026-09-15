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
    And I press the new tab button
    Then the page is at the top
    When I press tab 0
    Then the node "scroll-row-39" is shown
    And the page is back where I left it
    And the page has not reloaded
    And there should be no page errors
