@corpus:good
Feature: A shortlist says how much of the answer it drew
  The palette asks for eight hits and draws what comes back
  (`client/search/nodes.ts`'s `LIMIT`). A query that matched twenty things and
  a query that matched eight were therefore the same eight rows under the same
  silence — so the palette told a reader the directory holds eight of
  something it holds twenty of, while the honest number was on the wire the
  whole time (`SearchAnswer.total`, kept uncapped precisely so that "eight of
  ninety" is sayable).

  The filtered page has said all three of its truths since #248
  (`filter_in_place.feature`). The header's search door opens this same
  palette, so what is asserted here is what both of them draw. The wording
  itself is a unit test (`client/search/count.ts`).

  `@corpus:good` — nothing here writes.

  Background:
    Given I open the outline "house.olai"

  Scenario: The palette drew eight of what it found, and says which
    When I press the palette shortcut
    And I type "the" into the palette
    Then the palette found "8 of 20 matches"

  Scenario: A palette answer that fits says nothing about a total
    # The silence is the other half of the promise: "3 of 3 matches" is a
    # number a reader has to take in before they can ignore it, and the rows
    # already say how many there are.
    When I press the palette shortcut
    And I type "cabinets" into the palette
    Then the palette lists the node "order the new cabinets"
    And the palette says nothing about a total
