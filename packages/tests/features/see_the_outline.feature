@corpus:good
Feature: See the outline
  Opening an outline shows its tree. Almost everything on screen is DERIVED
  rather than stored — a parent's status, the tags inside a title, the subtree
  a mirror stands for — so these scenarios are as much about the derivation
  being right as about the pixels: `kitchen` says nothing about itself on disk,
  and the view has to work out that it is `doing` from its three children.

  Background:
    Given I open the outline "house.org"
    # These scenarios read the WHOLE tree — where a row sits, what its subtree
    # derives, a mirror's children — so they ask the page to show its
    # finished rows rather than leave the pick at its per-page default.
    And I show the done nodes

  Scenario: The tree shows the outline's nodes
    Then the tree is shown
    And the node "kitchen" is shown
    And the node "demo" is a child of "kitchen"
    And the node "handles" is a child of "install"

  Scenario: A node waiting on unfinished work says so in the mark column
    # `hinges` is `after` `order`, and `order` is under way — so `hinges`
    # cannot start yet. That is the same KIND of fact as whether it has
    # started, so it is answered where the box would be: the waiting glyph
    # stands in for the box, and the row dims. The mark itself is untouched —
    # `hinges` is still the `todo` somebody marked it with.
    Then the node "hinges" is blocked by "order"
    And the node "hinges" has status "todo"
    And the node "hinges" shows the waiting mark
    And the node "hinges" shows no checkbox

  Scenario: A row is its title, and a pilcrow says there is more
    # Compact: nothing under the title, and the mark beside it is the door.
    # What the open state holds, and the other densities, are
    # note_density.feature's; here the outline only promises that shape.
    When I read the outline with Notes on "compact"
    Then the node "order" shows a pilcrow
    And the node "order" draws nothing under its title

  Scenario: Collapsing a node hides its children, expanding brings them back
    Given the node "kitchen" is expanded
    And I mark the page
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When I expand the node "kitchen"
    Then the node "kitchen" is expanded
    And the children of "kitchen" are shown
    And the page has not reloaded

  Scenario: A mirror shows its target's subtree, inline and marked
    # `kitchen-herbs` lives in house.org and points at `herbs` in
    # garden.org — the one relation that crosses files.
    Then the node "kitchen-herbs" is marked as a mirror
    And the node "basil" is a child of "kitchen-herbs"
    And the node "mint" is a child of "kitchen-herbs"
    And there should be no page errors

  # ── a section holds its place ────────────────────────────────────────
  #
  # A TOP-LEVEL row is a section heading: a heavier name, its rollup as part of
  # that header, and `position: sticky` inside its own branch. The third claim
  # is the one nothing else covers — `the_header_sticks` pins the app bar and
  # `the_sidebar_sticks` pins the directory, and both were filed because a
  # permanent answer that scrolls away is not one. A section heading is that
  # same argument inside the page: a reader in the middle of a long branch
  # should not have to scroll back up to find out which section they are in.
  #
  # The window is made short rather than the fixture long, for the reason
  # `zoom_and_navigate.feature` gives at the step all four features share — and
  # the notes are opened for the same reason one step further: this corpus is
  # eight short rows, so at Compact the page has 82px of scroll and the heading's
  # own flow position lands within a pixel of the seam anyway. A scenario that
  # cannot tell a pinned heading from an unpinned one is not a scenario, and
  # this one was exactly that until it was measured against a client with the
  # `sticky` taken out.
  Scenario: A section heading holds the seam while its branch scrolls
    Given the window is shorter than the page
    And I read the outline with Notes on "open"
    When I scroll to the bottom of the page
    Then the section heading of "kitchen" is pinned under the header
    # The negative half, and it is what makes the claim mean anything: only a
    # TOP-LEVEL row is a section. A client that pinned every row would stack the
    # whole branch under the bar and still pass the line above.
    And the row "demo" is not pinned under the header
    And there should be no page errors
