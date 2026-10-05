@corpus:good
Feature: A shortlist says how much of the answer it drew
  Both doors onto the one search reading ask for eight hits and draw what comes
  back (`client/search/nodes.ts`'s `LIMIT`). A query that matched twenty things
  and a query that matched eight were therefore the same eight rows under the
  same silence — so both doors told a reader the directory holds eight of
  something it holds twenty of, while the honest number was on the wire the
  whole time (`SearchAnswer.total`, kept uncapped precisely so that "eight of
  ninety" is sayable).

  The filtered page has said all three of its truths since #248
  (`filter_in_place.feature`); these are the two doors that were left out of
  it, saying the one truth they have.

  TWO DOORS, TWO SCENARIOS, which is a deliberate exception to this suite's own
  rule about one law through one representative door: what is asserted here is
  not the law but that each door DRAWS it, and a door drawing nothing is
  precisely the defect. The wording itself is a unit test
  (`client/search/count.ts`).

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

  Scenario: The header's box says the same thing about the same answer
    When I search the header for "the"
    Then the header search found "8 of 20 matches"

  Scenario: A header answer that fits says nothing about a total
    When I search the header for "cabinets"
    Then the header search lists the node "order the new cabinets"
    And the header search says nothing about a total
