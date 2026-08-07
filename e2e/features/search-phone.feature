@phone
Feature: finding a node on a phone

  A phone has no keyboard shortcut to open anything with, so the palette has
  to be a thing you can hit: the button that opens it, and the box you then
  type into, are both a finger's target — and the sheet it opens is the width
  of the screen rather than a desktop card floating on it.

  Every scenario here runs on a 390x844 screen (support/world.js).

  Scenario: the palette is reachable, and typing still finds a node
    When I open the home page
    And I press the search button
    Then the search palette is open
    And the search box has the focus
    When I search for "milk"
    Then the search results name "Buy milk"
    When I tap the first hit
    Then I am on a node's own page
    And the tab is named for "Buy milk"

  Scenario: everything you have to hit is a target for a finger
    When I open the home page
    And I press the search button
    Then every search control is at least 44 pixels tall
    And the search box is at least 16 pixels of type
    And the search palette fits the screen
