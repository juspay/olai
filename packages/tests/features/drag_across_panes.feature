@scratch:good
Feature: Dragging a row from one pane into the other
  A drag was a fact about one page for as long as there was one page. With
  split panes (#225) it is a fact about the WORKSPACE: pick a row up by its
  bullet in one pane, carry it over the pane beside it, and the same drop line
  that has always said where it would land says so there — the same gap, the
  same depth, the same `place` the ops layer already had.

  TWO PANES, TWO ANSWERS. Showing the SAME file they reorganize each other:
  the write goes to the file, both trees redraw off the one store, and the row
  leaves one pane and arrives in the other on the same frame. Showing
  DIFFERENT files they cannot — a parent is always in the same file, which is
  the format's own rule and the one `move_node` refuses on — so the pane says
  so under the pointer, before the hand lets go, rather than swallowing a drop
  or landing it somewhere nobody was pointing.

  `@scratch:` for the reason the in-pane drag's scenarios are: these write the
  directory they are served, and each gets a private copy of it.

  # ── the same file in both panes ──────────────────────────────────────

  Scenario: A row picked up in one pane lands in the other, and both see it
    # The gap above `demo` is the first place under `kitchen`, and it is the
    # one gap in this outline whose depth the pointer cannot get wrong: the row
    # above is `kitchen` and the row below is its first child, so "one inside
    # the row above" and "level with the row below" are the same answer.
    When I open the address "/s/o%2Fhouse.olai/o%2Fhouse.olai"
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 1
    Then the drop line would put it under "kitchen"
    And the drop line would put it first
    When I let go
    # The pane it landed in...
    Then the node "knobs" is a child of "kitchen" in pane 1
    # ...and the pane it left, which is the same file drawn twice and therefore
    # the same news arriving twice.
    And the node "knobs" is a child of "kitchen" in pane 0
    And the node "knobs" is not a child of "install" in pane 0
    And "house.olai" holds the node "knobs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The line promising the landing is drawn over the pane it names
    # The affordance is identical to an in-pane drop's, which means it has to
    # be over the ROWS it is about — the pane the pointer is in, not the pane
    # the press began in.
    #
    # THIS IS THE GEOMETRIC ASSERTION, and it is worth saying that it carries
    # more than it looks like it does. With one file in both panes the two trees
    # are identical, so a plan made against the WRONG pane's boxes computes the
    # same `data-parent` and `data-after` — the scenario above cannot tell them
    # apart, and neither can the file. What separates them is where the line is
    # DRAWN, which is why this scenario exists and why the one below asserts the
    # same thing from the other side (review, opencode + grok, 2026-08-18).
    When I open the address "/s/o%2Fhouse.olai/o%2Fhouse.olai"
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 1
    Then the drop line is drawn over pane 1
    When I let go
    Then there should be no page errors

  Scenario: A drag that stays in its own pane still lands in its own pane
    # The regression this feature is most able to cause, and the reason every
    # measurement is now scoped to a pane: a `Row.key` is a chain from the roots
    # of ITS page, so two panes showing one file draw two sets of lines wearing
    # the SAME keys. Measured across the document, pane 0's gesture would be
    # planned against pane 1's boxes and promise its landing over there.
    When I open the address "/s/o%2Fhouse.olai/o%2Fhouse.olai"
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 0
    Then the drop line is drawn over pane 0
    And the drop line would put it under "kitchen"
    When I let go
    Then the node "knobs" is a child of "kitchen" in pane 0
    And there should be no page errors

  # ── two different files ──────────────────────────────────────────────

  Scenario: A row held over another file's pane is refused there, in words, before the drop
    When I open the address "/s/o%2Fhouse.olai/o%2Fgarden.olai"
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it over the title of "mint" in pane 1
    Then the drop is refused by "garden.olai"
    And the refused pane says "another file"
    And no drop line is drawn
    # And the promise is kept when the hand lets go: the same sentence, on the
    # bar every other refused gesture over these rows says its piece on, and the
    # row exactly where it was.
    When I let go
    Then the pick says "another file"
    And the node "knobs" is a child of "install" in pane 0
    And "house.olai" holds the node "knobs"
    And there should be no page errors

  Scenario: The pane the drag began in is unaffected by the one that refuses
    # One pointer, one pane, one answer — the refusal is about where the hand
    # IS, not about the split being open.
    When I open the address "/s/o%2Fhouse.olai/o%2Fgarden.olai"
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 0
    Then no drop is refused
    And the drop line would put it under "kitchen"
    When I let go
    Then the node "knobs" is a child of "kitchen" in pane 0
    And there should be no page errors

  # ── a pane zoomed INSIDE what the hand is holding ────────────────────

  Scenario: A pane zoomed into the branch being carried has nowhere to put it
    # The other way a page can have no landing, and the one that is NOT about
    # files: pane 1 is zoomed into `install`, so every row it draws is under the
    # branch pane 0 just lifted. "A branch is never offered a place inside
    # itself" is answered ACROSS two pages here, which a row key cannot do — a
    # zoomed page's keys start at its own roots, so `/handles` says nothing
    # about `install` being above it. What answers is the page's own zoom
    # ancestry (`drag/fields.ts`'s `within`), asked once for the whole page.
    #
    # Delete that early-out and this scenario fails rather than argues: pane 1's
    # three children become candidates, and the line offers to put `install`
    # inside itself — the loop the ops layer would then have to refuse.
    When I open the address "/s/o%2Fhouse.olai/n%2Finstall"
    And I mark the page
    And I pick up the bullet of "install" in pane 0 and hold it over the title of "handles" in pane 1
    Then the drop is refused by "house.olai"
    And the refused pane says "inside what you are carrying"
    # ...and NOT the file rule's words, which is the whole reason there are two
    # sentences: nothing here is about files at all.
    And the refused pane does not say "another file"
    And no drop line is drawn
    When I let go
    Then the pick says "inside what you are carrying"
    And the node "install" is a child of "kitchen" in pane 0
    And there should be no page errors
