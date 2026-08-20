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
  What lands is one `move_node`, the op an agent sends.

  THE LIMITS ARE SAID RATHER THAN HIDDEN, and that is most of what these
  scenarios are about. Every hit the search finds is drawn, including the ones
  the row cannot go under — its own subtree, another outline, the Trash, the
  parent it already has — and each says why, at the AIM: the sentence appears as
  the cursor arrives on the row, before `Enter`, which is the shape #238 shipped
  for a drop over another file's pane. A picker that quietly dropped those rows
  would be teaching a rule this app does not have, and a reader hunting for a
  title they can see would be debugging a search.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── the gesture, end to end ─────────────────────────────────────────

  Scenario: ⌘⇧M opens the picker on the row the caret is in
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "knobs"
    And no row is being edited

  Scenario: A destination chosen with Enter carries the row and its subtree
    # `install` holds three rows and lives under `kitchen`; `order` is its
    # sibling. Moving it under `order` is one `move_node`, and what follows it
    # is the whole branch — `handles` is still its child afterwards, drawn
    # under it in its new home.
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
    # Where among the children is not a field on the wire: "last" is the ops
    # layer's own default for a `move_node` naming a parent and no anchor, read
    # where the write is judged. `install` already holds `handles`, `hinges`
    # and `knobs`, so a row arriving there arrives after all three.
    When I click the title of "demo"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "install the cabinets"
    And I choose "install the cabinets" from the move picker
    Then the node "demo" is a child of "install"
    And the node "knobs" comes before "demo"
    And there should be no page errors

  Scenario: The picker shuts when the move lands, and ⌘Z brings the row back
    # One stack whichever hand made the edit — and the inverse of this move is
    # a `place`, the parent AND the neighbour the row left, so it comes back
    # where it sat rather than at the end of its old siblings.
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
    # The ops layer's `nudge`, and the reason the panel's said line outlives the
    # panel: `demo` is done, `knobs` is a task nobody has finished, and putting
    # one under the other would leave finished work standing over unfinished
    # work — which done-hidden would sweep off the page. So the mark comes off
    # `demo` and the write says which, to the person who caused it exactly as it
    # would to the agent that did. The row has MOVED by then, so the sentence is
    # drawn in its new home rather than where the panel was opened.
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I choose "take out the old counters" from the move picker
    Then the node "knobs" is a child of "demo"
    And the move noted "marked done over work that is not finished"
    And there should be no page errors

  Scenario: A row that lands where the page draws nothing still says what happened
    # The one case following the row is not enough for: a COLLAPSED destination
    # draws none of its children, so the row that just moved into it is not on
    # the page at all — and the sentence would go with it. It falls back to the
    # row it landed IN, which is drawn, is the nearest thing on screen to where
    # the row went, and for this sentence is the row it is about. Nothing is
    # unfolded on the reader's behalf.
    # Written by another hand so the finished branch has a child to be
    # collapsed BY — a row with nothing under it draws no triangle — and the
    # rewrite is waited for by the row it adds, before anything is pressed on a
    # page it redrew.
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

  # ── the way out, and where the caret goes ───────────────────────────

  Scenario: Escape puts the picker away and hands the caret back to the row
    # ⌘⇧M is the KEYBOARD door, so a way out that left focus on the document
    # would be a reader reaching for the pointer to get back into the outline —
    # the rule the `•••` menu already keeps (a key gets the caret back, a
    # pointer does not). There is no trigger element to restore here; the row's
    # own editor is where the reader was.
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "knobs"
    And no row is being edited
    When I press "Escape"
    Then no move picker is open
    And the row "knobs" holds the caret
    And there should be no page errors

  # ── the `•••` door, which is the only one a finger has ──────────────

  Scenario: The menu offers Move to…, and it opens the same panel
    When I open the node menu of "knobs"
    Then the node menu offers "Move to…"
    When I choose "Move to…" from the node menu
    Then the move picker is open on "knobs"
    And there should be no page errors

  Scenario: Enter on a cross-file destination writes nothing at all
    # The aim is the answer: the sentence was on screen before the key, the
    # picker stays open, and the row has not moved.
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "the compost heap"
    And I press "Enter"
    Then the move picker is open on "knobs"
    And the move picker refuses with "Every outline is an independent tree"
    And the node "knobs" is a child of "install"
    And there should be no page errors

  Scenario: The reason is about the row the cursor is ON, and moves with it
    # What "at the aim" MEANS, in one list: `cabinets` finds two rows of this
    # outline, one of which is the row being moved. The sentence is about
    # whichever the cursor is on — walk off it and there is nothing to say,
    # because that destination can take the row.
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "cabinets"
    And I point the move picker at "install the cabinets"
    Then the move picker refuses with "the row you are moving"
    When I point the move picker at "order the new cabinets"
    Then the move picker refuses nothing
    And there should be no page errors

  # ── a placement, which moves as itself ──────────────────────────────

  Scenario: A mirror moves as the placement it is, and its target stays put
    # The rule every move on this face follows: where a row SITS names the row's
    # own record. `kitchen-herbs` is a placement of `herbs`, which lives in
    # `garden.olai` — moving the line moves the line, and the node it draws is
    # not touched.
    When I open the node menu of "kitchen-herbs"
    And I choose "Move to…" from the node menu
    And I search the move picker for "install the cabinets"
    And I choose "install the cabinets" from the move picker
    Then the node "kitchen-herbs" in "house.olai" sits under "install"
    And the node "herbs" in "garden.olai" sits under "garden"
    And there should be no page errors
