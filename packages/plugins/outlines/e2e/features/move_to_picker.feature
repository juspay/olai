@share-scratch
@scratch:good
Feature: Moving a row to a parent you search for
  Every way this app had of moving a row was a step from where it already was:
  `Tab` goes under the sibling above, `Shift+Tab` up a level, the arrows walk
  among siblings, and a drag reaches as far as the pointer can travel. None of
  them can say "this belongs under that node three hundred rows down", which is
  the move a person actually means when a branch has ended up in the wrong
  place.

  So: ⌘⇧M on the row (Workflowy's own chord), and `Move to…` in the `•••` for
  the hand that has no keyboard. Both open one panel in place under the row —
  the search every other door in this client uses, over the whole set — and
  `Enter` carries the row, with everything under it, under the node chosen.
  What lands is one `outlines_move`, the op an agent sends.

  ANOTHER OUTLINE IS A DESTINATION, and that is the newest thing here. The
  search is of the whole directory, so it finds rows of every file; picking one
  carries the row and everything under it into that outline, KEEPING EVERY ID,
  so the mirrors and edges pointing at what moved go on resolving. It used to be
  drawn dimmed with a sentence about independent trees — a fence around the
  planner rather than around the format, and the reason a cross-file move had to
  be faked by writing the branch out again under new ids.

  THE LIMITS THAT REMAIN ARE SAID RATHER THAN HIDDEN, and that is most of what
  these scenarios are about. Every hit the search finds is drawn, including the
  ones the row cannot go under — its own subtree, the Trash, the parent it
  already has — and each says why, at the AIM: the sentence appears as the
  cursor arrives on the row, before `Enter`, which is the shape #238 shipped
  for a drop over another file's pane. A picker that quietly dropped those rows
  would be teaching a rule this app does not have, and a reader hunting for a
  title they can see would be debugging a search.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: ⌘⇧M opens the picker on the row the caret is in
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "knobs"
    And no row is being edited

  Scenario: A destination chosen with Enter carries the row and its subtree
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "order the new"
    And I choose "order the new cabinets" from the move picker
    Then the node "install" in "house.olai" sits under "order"
    And the node "install" is a child of "order"
    And the node "handles" is a child of "install"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The row lands LAST among its new siblings
    When I click the title of "demo"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "install the cabinets"
    And I choose "install the cabinets" from the move picker
    Then the node "demo" is a child of "install"
    And the node "knobs" comes before "demo"
    And there should be no page errors

  Scenario: The picker shuts when the move lands, and ⌘Z brings the row back
    When I click the title of "hinges"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "order the new"
    And I choose "order the new cabinets" from the move picker
    Then the node "hinges" is a child of "order"
    And no move picker is open
    When I press "ControlOrMeta+z"
    Then the node "hinges" is a child of "install"
    And the node "handles" comes before "hinges"
    And there should be no page errors

  Scenario: A move that re-opens a finished branch says so, under the row
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I choose "take out the old counters" from the move picker
    Then the node "knobs" is a child of "demo"
    And the move noted "marked done over work that is not finished"
    And there should be no page errors

  Scenario: A row that lands where the page draws nothing still says what happened
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"dust","parent":"demo","ord":"a0","title":"sweep up after","done":"2026-08-03"}
      {"id":"knobs","parent":"kitchen","ord":"a1","title":"pick the knobs","todo":"2026-08-11"}
      """
    Then the node "dust" is shown
    When I collapse the node "demo"
    And I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I choose "take out the old counters" from the move picker
    Then the node "knobs" in "house.olai" sits under "demo"
    And the node "knobs" is not shown
    And the move noted "marked done over work that is not finished"
    And there should be no page errors

  Scenario: Escape puts the picker away and hands the caret back to the row
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "knobs"
    And no row is being edited
    When I press "Escape"
    Then no move picker is open
    And the row "knobs" holds the caret
    And there should be no page errors

  Scenario: The menu offers Move to…, and it opens the same panel
    When I open the node menu of "knobs"
    Then the node menu offers "Move to…"
    When I choose "Move to…" from the node menu
    Then the move picker is open on "knobs"
    And there should be no page errors

  Scenario: A destination in ANOTHER OUTLINE carries the row there, subtree and all
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "the compost heap"
    And I choose "the compost heap" from the move picker
    Then the node "install" in "garden.olai" sits under "compost"
    And the node "handles" in "garden.olai" sits under "install"
    And the node "knobs" in "garden.olai" sits under "install"
    And the node "install" is not shown
    And no move picker is open
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘Z brings a row back from the outline it was carried into
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "the compost heap"
    And I choose "the compost heap" from the move picker
    Then the node "install" in "garden.olai" sits under "compost"
    When I press "ControlOrMeta+z"
    Then the node "install" in "house.olai" sits under "kitchen"
    And the node "order" comes before "install"
    And the node "handles" is a child of "install"
    And there should be no page errors

  Scenario: The reason is about the row the cursor is ON, and moves with it
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "cabinets"
    And I point the move picker at "install the cabinets"
    Then the move picker refuses with "the row you are moving"
    When I point the move picker at "order the new cabinets"
    Then the move picker refuses nothing
    And there should be no page errors

  Scenario: A mirror moves as the placement it is, and its target stays put
    When I open the node menu of "kitchen-herbs"
    And I choose "Move to…" from the node menu
    And I search the move picker for "install the cabinets"
    And I choose "install the cabinets" from the move picker
    Then the node "kitchen-herbs" in "house.olai" sits under "install"
    And the node "herbs" in "garden.olai" sits under "garden"
    And there should be no page errors

  @wire
  Scenario: A landed move asks nothing more, and lets go of the question with its sentence
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I mark the wire
    And I choose "take out the old counters" from the move picker
    Then the node "knobs" is a child of "demo"
    And the move noted "marked done over work that is not finished"
    And the tab has asked to judge this move 0 times
    When the move's sentence has gone
    And I mark the wire
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters"}
      {"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets","desc":"[document](finishes.md)"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs","todo":"2026-08-11"}
      {"id":"dust","parent":"kitchen","ord":"a3","title":"sweep up after"}
      """
    Then the node "dust" is shown
    And the node "knobs" is not a child of "demo"
    And the tab has asked to judge this move 0 times
    And the set has said nothing more about moving "knobs"
    And there should be no page errors

  @wire
  Scenario: A second picker asks about its OWN list, not the last one's
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I choose "take out the old counters" from the move picker
    Then the move noted "marked done over work that is not finished"
    When I mark the wire
    And I open the node menu of "hinges"
    And I choose "Move to…" from the node menu
    Then the move picker is open on "hinges"
    And the tab has never asked to judge a move against "demo"
    And the tab has asked to judge this move 1 times
    And there should be no page errors

  Scenario: The heading's tag is words too, while the panel is open
    When I click the title of "kitchen"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "kitchen"
    When I press the tag "#home" in the open move picker
    Then the move picker is open on "kitchen"
    And the address is exactly "/house.olai"
    And the page has not reloaded
    And there should be no page errors
