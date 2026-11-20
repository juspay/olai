Feature: The outline remembers how you left it
  Folding used to belong to the PAGE: every reload, every zoom, every hop to
  another outline handed the reader a tree with everything open again, and a
  person with a real corpus re-collapsed the same branches every single visit.
  That is the bug this feature closes (2026-08-13, human).

  A fold is a preference of this BROWSER now — kept in its own storage, never
  sent anywhere, never written into a `.olai` and never committed — and it is
  kept BY NODE. Three things follow, and each one is a scenario below: it
  survives a reload, it survives zooming in and back out (a place key would not:
  the walk under a node spells the same row differently), and every mirror of a
  node is folded wherever that node appears, because one node has one fold.

  The directory's folders are the same memory, inverted: nodes start open so
  what is stored is what is shut, and folders start collapsed (#105) so what is
  stored is what is open.

  A fourth follows and has a scenario of its own — "A fold follows its node into
  the Trash" — and it is the one no unit test can say: the memory is kept FILED
  against a directory that MOVES. Where a fold lives is asked of the server now,
  since the browser stopped holding an id→file map of the whole vault to answer
  it, so what that scenario proves is the round trip end to end, over a real
  write nobody in this tab made. The arithmetic it lands on is pinned where
  arithmetic belongs (`fold/memory.test.ts`, `ops/query.test.ts`). It is the
  one scenario here that WRITES the directory it is served, which is why the
  corpus tag sits on each scenario rather than on the feature.

  @corpus:good
  Scenario: A tree you collapsed is still collapsed after a reload
    Given I open the outline "house.olai"
    And the node "kitchen" is expanded
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When I reload the page
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And there should be no page errors

  @corpus:good
  Scenario: A fold survives zooming in and back out
    Given I open the outline "house.olai"
    When I collapse the node "install"
    Then the node "install" is collapsed
    When I zoom into the node "kitchen"
    Then the node "install" is collapsed
    And the children of "install" are hidden
    When I go back
    Then the node "install" is collapsed
    And there should be no page errors

  @corpus:good
  Scenario: A node folded on its own page is folded on the outline
    Given I open the node "kitchen"
    When I collapse the node "install"
    And I open the outline "house.olai"
    Then the node "install" is collapsed

  @corpus:good
  Scenario: Mirrors of one node fold together
    Given I open the outline "house.olai"
    When I collapse the node "kitchen-herbs"
    Then the children of "kitchen-herbs" are hidden
    And this browser remembers "herbs" folded in "garden.olai"
    When I open the outline "garden.olai"
    Then the node "herbs" is collapsed
    And the children of "herbs" are hidden

  @scratch:good
  Scenario: A fold follows its node into the Trash
    Given I open the outline "house.olai"
    When I collapse the node "install"
    Then this browser remembers "install" folded in "house.olai"
    When another writer archives "install" out of "house.olai"
    Then the node "install" is not shown
    When I reload the page
    Then this browser remembers "install" folded in "_olai/Trash.olai"
    And there should be no page errors

  @corpus:good
  Scenario: A folder you opened in the directory is still open after a reload
    Given I open the outline "house.olai"
    And the folder "Daily" is collapsed
    When I expand the folder "Daily"
    Then the folder "Daily" is expanded
    When I reload the page
    Then the folder "Daily" is expanded
    And this browser remembers the folder "Daily" open
