@share-scratch
@scratch:good
Feature: A row keeps its furniture while its title is typed
  What an editor replaces is the title CELL and nothing else. Everything a row
  says after its title — the pilcrow that opens its note, the aside, the chip a
  plugin hangs on it, the date and the ⏱ — is about the node rather than about
  whether its title is being written.

  A row used to lose all of it for the length of an edit, because the editor
  replaced the whole LINE: a row with a note and a chip blinked its furniture
  in and out on every click between its title and its note. The claim below is
  the strongest one available — the same ELEMENTS, in the same place, to the
  pixel — because "still there" and "not remade" are different promises, and
  the second is the one a person sees.

  Scenario: Clicking between a row's title and its note moves nothing
    Given I open the outline "house.olai"
    When I write down where the facts of "order" sit
    And I click the title of "order"
    Then the title of "order" is being typed
    And the facts of "order" sit where they sat
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    And the facts of "order" sit where they sat
    When I click the title of "order"
    Then the title of "order" is being typed
    And the facts of "order" sit where they sat
    And there should be no page errors
