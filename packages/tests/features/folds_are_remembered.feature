@corpus:good
Feature: The outline remembers how you left it
  Folding used to belong to the PAGE: every reload, every zoom, every hop to
  another outline handed the reader a tree with everything open again, and a
  person with a real corpus re-collapsed the same branches every single visit.
  That is the bug this feature closes (2026-08-13, human).

  A fold is a preference of this BROWSER now — kept in its own storage, never
  sent anywhere, never written into a `.jsonl` and never committed — and it is
  kept BY NODE. Three things follow, and each one is a scenario below: it
  survives a reload, it survives zooming in and back out (a place key would not:
  the walk under a node spells the same row differently), and every mirror of a
  node is folded wherever that node appears, because one node has one fold.

  The directory's folders are the same memory, inverted: nodes start open so
  what is stored is what is shut, and folders start collapsed (#105) so what is
  stored is what is open.

  Scenario: A tree you collapsed is still collapsed after a reload
    # The complaint, verbatim, as a scenario.
    Given I open the outline "house.jsonl"
    And the node "kitchen" is expanded
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When I reload the page
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And there should be no page errors

  Scenario: ...and opening it again is remembered too
    # The other direction, which a store of "what was collapsed" only gets right
    # if unfolding REMOVES rather than doing nothing: a node nobody has touched
    # and a node somebody has opened both draw open.
    Given I open the outline "house.jsonl"
    When I collapse the node "kitchen"
    And I reload the page
    Then the node "kitchen" is collapsed
    When I expand the node "kitchen"
    And I reload the page
    Then the children of "kitchen" are shown
    And this browser remembers no folds

  Scenario: A fold survives zooming in and back out
    # The deliberate bonus of keying by node: a zoomed page derives its rows
    # from the node down, so the same row has a different PLACE key there than
    # it does on the whole outline. Folding by id makes the round trip a
    # no-op, which is what a reader who zoomed in to look at one branch means.
    Given I open the outline "house.jsonl"
    When I collapse the node "install"
    Then the node "install" is collapsed
    When I zoom into the node "kitchen"
    Then the node "install" is collapsed
    And the children of "install" are hidden
    When I go back
    Then the node "install" is collapsed
    And there should be no page errors

  Scenario: A node folded on its own page is folded on the outline
    # The same claim from the other end, and cold: `/n/<id>` is a permalink
    # somebody can arrive at with no history behind it.
    Given I open the node "kitchen"
    When I collapse the node "install"
    And I open the outline "house.jsonl"
    Then the node "install" is collapsed

  Scenario: Mirrors of one node fold together
    # THE RULING (2026-08-13): one node, one fold state. `kitchen-herbs` in
    # house.jsonl is a mirror of `herbs`, which lives in garden.jsonl — so
    # folding the placement is a fact about the node, and the node's own row in
    # its own outline is folded with it.
    Given I open the outline "house.jsonl"
    When I collapse the node "kitchen-herbs"
    Then the children of "kitchen-herbs" are hidden
    And this browser remembers "herbs" folded in "garden.jsonl"
    When I open the outline "garden.jsonl"
    Then the node "herbs" is collapsed
    And the children of "herbs" are hidden

  Scenario: Collapse all is remembered, and so is expand all
    # The menu's two bulk verbs go through the same memory as the triangle, so
    # a reader who shut a whole branch does not find it open on the next visit.
    Given I open the outline "house.jsonl"
    When I open the node menu of "kitchen"
    And I choose "Collapse all" from the node menu
    And I reload the page
    Then the node "kitchen" is collapsed
    When I expand the node "kitchen"
    Then the node "install" is collapsed
    When I open the node menu of "kitchen"
    And I choose "Expand all" from the node menu
    And I reload the page
    Then the children of "install" are shown

  Scenario: A folder you opened in the directory is still open after a reload
    Given I open the outline "house.jsonl"
    And the folder "Daily" is collapsed
    When I expand the folder "Daily"
    Then the folder "Daily" is expanded
    When I reload the page
    Then the folder "Daily" is expanded
    And this browser remembers the folder "Daily" open

  Scenario: Folding asks the server for nothing
    # The whole doctrine as an assertion: how this reader is reading is not
    # something the directory is told, so nothing crosses the wire and nothing
    # reaches a file. "It works" and "it works without asking anybody" look
    # identical on screen.
    Given I open the outline "house.jsonl"
    When I watch what the page asks for
    And I collapse the node "kitchen"
    Then the page asked for nothing at all

  Scenario: A fold made in another tab lands in this one
    # A preference belongs to the BROWSER, and a browser is more than one tab —
    # the same `storage` event the theme and the Done default ride. A reload
    # scenario cannot ask this: deleting the listener entirely would leave every
    # other scenario here green.
    Given I open the outline "house.jsonl"
    And the node "kitchen" is expanded
    When a second tab collapses the node "kitchen"
    Then the node "kitchen" is collapsed
    And there should be no page errors
