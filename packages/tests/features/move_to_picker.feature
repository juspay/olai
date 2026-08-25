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

  # ── across outlines, which is the door an agent got at the same time ──

  Scenario: A destination in ANOTHER OUTLINE carries the row there, subtree and all
    # The gesture this scenario exists for is the one that used to be dimmed:
    # `compost` lives in `garden.olai` and the row lives in `house.olai`.
    # `install` holds three rows and an attached document, and what lands is one
    # `move_node` naming a parent in another file — the op an agent sends.
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "the compost heap"
    And I choose "the compost heap" from the move picker
    Then the node "install" in "garden.olai" sits under "compost"
    # …with everything under it, under the ids it always had. That is what makes
    # this a move rather than a copy written out again somewhere else, and it is
    # why `hinges`' `after` edges still name rows in the outline it left.
    And the node "handles" in "garden.olai" sits under "install"
    And the node "knobs" in "garden.olai" sits under "install"
    # …and it is off THIS page, because this page is another file now. The row
    # did not vanish; it is somewhere a reader can open.
    And the node "install" is not shown
    And no move picker is open
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘Z brings a row back from the outline it was carried into
    # One stack whichever hand made the edit, and the inverse of a crossing is
    # the same `place` every other move records — the parent AND the neighbour
    # the row left, read where the write is judged, so the row comes back
    # between `order` and `kitchen-herbs` rather than at the end of them.
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

  # ── what the gesture costs the wire ─────────────────────────────────

  @wire
  Scenario: A landed move asks nothing more, and lets go of the question with its sentence
    # TWO CLAIMS THAT ARE NOT ON SCREEN, which is why they are counted rather
    # than looked at. The panel holds ONE subscription — this record, these
    # destinations — and it stands open while anybody writes, so it is re-read
    # whenever a frame moves the row. The question does not change when the row
    # moves, and the picker being SPENT is the end of the question altogether.
    #
    # Both were wrong. The request was minted fresh on every frame that re-filed
    # where the row is drawn, so a value-identical question tore the stream down
    # and blanked the answer — every refused destination un-dimming for a round
    # trip. And the spent gesture was never put down: the sentence took itself
    # away after six seconds, and the subscription stayed open for ever, with
    # the whole visible tree flattened on every frame behind a panel nobody
    # could see.
    #
    # The nudge is what makes this the case worth counting: it is a landing with
    # something to SAY, so the gesture genuinely outlives the panel and there is
    # a sentence to wait out.
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I mark the wire
    And I choose "take out the old counters" from the move picker
    Then the node "knobs" is a child of "demo"
    And the move noted "marked done over work that is not finished"
    # The row moved under the panel and was re-found there — and the question is
    # about the record and the destinations, neither of which moved.
    And the tab has asked to judge this move 0 times
    When the move's sentence has gone
    # …and the wire is marked again, because what the next line is about is the
    # frame AFTER the gesture ended rather than the landing that ended it.
    And I mark the wire
    # Another hand moves the row again. There is nothing of the gesture left, so
    # this frame reaches nothing at all.
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters"}
      {"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets","doc":"finishes.md"}
      {"id":"knobs","parent":"kitchen","ord":"a2","title":"pick the knobs","todo":"2026-08-11"}
      {"id":"dust","parent":"kitchen","ord":"a3","title":"sweep up after"}
      """
    # Waited for by the row the rewrite ADDS, which is the only wait that says
    # this page has drawn that frame: "knobs is inside kitchen" was already true
    # while it sat under `demo`, and a step that read it would make the two
    # claims below about a frame that had not arrived.
    Then the node "dust" is shown
    And the node "knobs" is not a child of "demo"
    And the tab has asked to judge this move 0 times
    # The load-bearing one, and the only trace an un-closed subscription leaves:
    # nothing is drawn from an answer to a question nobody is asking, so the
    # arrival of one is the whole evidence.
    And the set has said nothing more about moving "knobs"
    And there should be no page errors

  @wire
  Scenario: A second picker asks about its OWN list, not the last one's
    # THE OTHER END OF THE SAME GESTURE'S LIFETIME, and the one the scenario
    # above cannot reach. The panel's destinations come from the shortlist, and
    # the shortlist hands its list up when it MOUNTS — which is after the picker
    # has been opened. So the destinations a picker starts with are whatever was
    # there before it, and unless opening one puts them down, the first thing a
    # second picker does is ask the set to judge its row against the rows the
    # LAST list was showing: a verdict about a list that is off the screen, and
    # a round trip spent on it.
    #
    # `knobs` is moved under `demo` first, so there is a spent gesture to open
    # the second picker on top of — its said line is still standing, and the
    # destination it was judged against was `demo`.
    When I click the title of "knobs"
    And I press "ControlOrMeta+Shift+m"
    And I search the move picker for "take out the old"
    And I choose "take out the old counters" from the move picker
    Then the move noted "marked done over work that is not finished"
    When I mark the wire
    And I open the node menu of "hinges"
    And I choose "Move to…" from the node menu
    # Waited for by the panel being DRAWN, which is what says its first question
    # has been asked and answered: the picker draws off that answer.
    Then the move picker is open on "hinges"
    # The defect, said directly: `demo` is the destination the LAST list was
    # judged against, and this panel has never shown it.
    And the tab has never asked to judge a move against "demo"
    # …and its cost, said as a count: one question for one panel, rather than a
    # wrong one and then a right one.
    And the tab has asked to judge this move 1 times
    And there should be no page errors

  Scenario: The heading's tag is words too, while the panel is open
    # The heading names the row through the one title pipeline, so `kitchen
    # remodel #home`'s tag is the pill there — and a press of a pill that fell
    # through to the page's filter router would narrow the tree out from
    # under an open write panel (`client/move/MovePicker.tsx` claims it the
    # same way the search rows do). The press leaves the pick and the page
    # as they were.
    When I click the title of "kitchen"
    And I press "ControlOrMeta+Shift+m"
    Then the move picker is open on "kitchen"
    When I press the tag "#home" in the open move picker
    Then the move picker is open on "kitchen"
    And the address is exactly "/house.olai"
    And the page has not reloaded
    And there should be no page errors
