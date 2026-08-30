@corpus:good
Feature: Workflowy gutter
  The outline gutter matches Workflowy: ONE glyph cell, a gray halo when
  children are hidden, a hover-reveal `•••` menu and collapse triangle left of
  it. What that menu can DO to a node is `menu_verbs.feature` and how its panel
  opens and shuts is `menu_panel.feature`; this is the gutter it hangs in, and
  the reading verbs it has always had.

  ONE CELL, not two (the quiet outline). The bullet and the status box used to
  be separate columns, so every row in every tree spent two fixed widths before
  its title to say one thing. They are merged: the glyph IS the mark when the
  node carries one, the bullet when it does not, the hourglass when it cannot
  start yet — and it is the link into the node in all three cases. What each
  face means is `see_the_outline.feature`'s; that it is one control is this
  feature's.

  Background:
    Given I open the outline "house.olai"
    # The fold's receipt COUNTS drawn rows, and each page hides its finished
    # ones by default now: showing them is what gives the folds something
    # finished to hold back.
    And I show the done nodes

  Scenario: The mark and the way into the node are one cell
    # `order` carries `doing`, so its glyph is the half-filled box — and that
    # same cell is the link to its page. A row with NO mark draws a bullet
    # there instead, which is why "shows no checkbox" goes on meaning
    # something.
    Then the node "order" shows a doing checkbox
    And the node "handles" shows no checkbox
    When I click the bullet of "order"
    Then the zoomed node is "order"

  Scenario: A collapsed parent shows the halo on its bullet
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the node "kitchen" shows a collapsed halo
    And the children of "kitchen" are hidden
    # ...and it says how much finished work went with them, rather than hiding
    # it silently: done rows recede far enough that a fold over them has to
    # leave a receipt. TWO, at every depth of what the fold hid — `demo`
    # directly under it, and `basil` through the mirror of `herbs`, which is
    # part of this branch's reading like any other row.
    And the node "kitchen" says it is folding "2" finished rows

  Scenario: A fold over nothing finished says nothing
    Given the node "install" is expanded
    When I collapse the node "install"
    Then the node "install" is collapsed
    # Three children, none of them done: a zero is not drawn.
    And the node "install" says nothing about folded finished rows

  Scenario: Expanding clears the halo
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    And I expand the node "kitchen"
    Then the node "kitchen" shows no collapsed halo

  Scenario: On a pointer device the menu and triangle are hidden until hover
    # The negative half of hover-reveal: without this, permanently-visible
    # controls would still pass every "is revealed" scenario.
    Given the node "kitchen" is expanded
    Then the node menu of "kitchen" is hidden
    And the collapse control of "kitchen" is hidden
    When I hover the node "kitchen"
    Then the node menu of "kitchen" is revealed
    And the collapse control of "kitchen" is revealed

  Scenario: Focusing the collapse control reveals the hover strip
    Given the node "kitchen" is expanded
    When I focus the collapse control of "kitchen"
    Then the collapse control of "kitchen" is revealed
    And the node menu of "kitchen" is revealed

  Scenario: The node menu's five read actions come first
    # What this row can WRITE is `menu_verbs.feature`'s subject; what belongs
    # here is that the reads are still at the top of the panel, in the order
    # they were, above the rule that separates them from everything that
    # changes the directory.
    When I open the node menu of "kitchen"
    Then the node menu offers "Zoom in"
    And the node menu offers "Collapse"
    And the node menu offers "Expand all"
    And the node menu offers "Collapse all"
    And the node menu offers "Copy link to node"

  Scenario: Zoom in from the menu stays in the same document
    Given I mark the page
    When I open the node menu of "kitchen"
    And I choose "Zoom in" from the node menu
    Then the zoomed node is "kitchen"
    And the page has not reloaded

  Scenario: Collapse from the menu hides children
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "Collapse" from the node menu
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node "kitchen" shows a collapsed halo

  Scenario: Expand all from the menu opens a nested fold
    Given the node "kitchen" is expanded
    And the node "install" is expanded
    When I collapse the node "install"
    And I open the node menu of "kitchen"
    And I choose "Expand all" from the node menu
    Then the node "kitchen" is expanded
    And the node "install" is expanded
    And the children of "install" are shown

  # ── the fold's receipt, and when it is somebody else's to give ────────
  #
  # A collapsed row usually carries the rollup too, and on most branches those
  # are the same number twice — `3/4` already reports three finished tasks, so
  # `+3 done` beside it is the second, dumber spelling of one fact. The human
  # ruled on it after seeing both on one line: where the rollup says it, the
  # fold says nothing. Both halves are here, because the rule is a COMPARISON
  # and not "drop the count wherever there is a rollup" — the two numbers count
  # different things, and the second scenario is the branch where they diverge.

  Scenario: Where the rollup already counts it, the fold says nothing
    # `compost` is two done children and nothing else: its rollup reads 2/2 and
    # the fold would report the same two.
    Given I open the outline "garden.olai"
    And I show the done nodes
    And the node "compost" is expanded
    When I collapse the node "compost"
    Then the node "compost" is collapsed
    And the node "compost" shows the progress "2/2"
    And the node "compost" says nothing about folded finished rows

  Scenario: Where the rollup cannot see it, the fold still says so
    # `garden`'s rollup is 0/1 — `herbs` is the only child anybody marked — and
    # five finished rows are hidden under the two unmarked children beside it.
    # A rollup is one level deep on purpose (`@olai/format`'s `progressOf` says
    # why: `3/5` beside a title is about the five rows drawn under it), so it is
    # blind to exactly this, and the count is the only thing left saying that a
    # branch reading 0/1 is not empty of finished work.
    Given I open the outline "garden.olai"
    And I show the done nodes
    And the node "garden" is expanded
    When I collapse the node "garden"
    Then the node "garden" is collapsed
    And the node "garden" shows the progress "0/1"
    And the node "garden" says it is folding "5" finished rows
