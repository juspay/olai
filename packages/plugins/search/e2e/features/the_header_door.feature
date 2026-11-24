@corpus:good
Feature: The header's search button opens the palette
  On a desktop the header holds a button that says `Search` and the palette's
  chord. It opens the same palette the chord does, which is where search is
  typed and drawn: no text box stands in the bar, and no second list of
  results hangs under it. A phone keeps its magnifier, which opens the same
  palette (`palette_levels.feature`).

  Background:
    Given I open the outline "house.olai"

  Scenario: The button says its chord and opens the palette when clicked
    Then the header's search button shows the palette's chord
    And the header holds no text box
    When I click the header's search button
    Then the command palette is open
    When I type "cabinets" into the palette
    Then the palette lists the node "order the new cabinets"
    And there should be no page errors

  Scenario Outline: The button opens the palette from the keyboard with <key>
    When I press "<key>" on the header's search button
    Then the command palette is open
    When I close the palette
    Then the command palette is closed
    And there should be no page errors

    Examples:
      | key   |
      | Enter |
      | Space |
