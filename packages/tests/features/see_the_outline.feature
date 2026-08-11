@corpus:good
Feature: See the outline
  Opening an outline shows its tree. Almost everything on screen is DERIVED
  rather than stored — a parent's status, the tags inside a title, the subtree
  a mirror stands for — so these scenarios are as much about the derivation
  being right as about the pixels: `kitchen` says nothing about itself on disk,
  and the view has to work out that it is `doing` from its three children.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: The tree shows the outline's nodes
    Then the tree is shown
    And the node "kitchen" is shown
    And the node "demo" is a child of "kitchen"
    And the node "handles" is a child of "install"

  Scenario: A node shows its title
    Then the node "kitchen" has the title "kitchen remodel #home"

  Scenario: A leaf shows the status it stores
    Then the node "demo" has status "done"
    And the node "order" has status "doing"
    And the node "hinges" has status "todo"

  Scenario: A bullet nobody marked is not a task
    # `handles` carries no mark. It is not "a task nobody has started" — it is
    # a bullet, and the page says so by saying nothing: no status on the row,
    # no box beside it, no strike or tone on the title. `knobs` beside it IS
    # an unstarted task, and says so with the mark someone put there.
    Then the node "handles" has no status
    And the node "handles" shows no checkbox

  Scenario: Status is a checkbox beside the bullet
    # The racket original drew status as a box, not only as title tone. All
    # three MARKS render one: checked for done, half for doing, and an EMPTY
    # box for todo. The empty box is what `todo` looks like — it is not what
    # an unmarked node looks like, which is no box at all.
    Then the node "demo" shows a checked checkbox
    And the node "order" shows a doing checkbox
    And the node "knobs" shows an empty checkbox

  Scenario: A parent shows the mark it stores, like any other node
    # `kitchen` carries `doing` itself. Nothing is computed from its children:
    # a mark is on the node that carries it, whether or not anything hangs
    # below (resolved 2026-08-11).
    Then the node "kitchen" has status "doing"
    And the node "kitchen" shows a doing checkbox

  Scenario: A parent nobody marked is a bullet, whatever its children carry
    # `install` carries no mark, and a `todo` child does not make it a task —
    # someone has to say so. So it draws no box at all, exactly like a note.
    Then the node "install" has no status
    And the node "install" shows no checkbox

  Scenario: A parent with tasks under it shows how far they have got
    # An ANNOTATION beside the title, never the checkbox: `kitchen` is `doing`
    # because somebody said so, and `1/2` is what its two task children add up
    # to. The unmarked child is not counted, and neither is the mirror.
    Then the node "kitchen" shows the progress "1/2"
    # A node with no tasks under it shows none — there is nothing to count,
    # rather than nothing done out of nothing.
    And the node "demo" shows no progress

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

  Scenario: Waiting is not the same news as finished
    # `knobs` is an unstarted task nothing is waiting on: it keeps its empty
    # box and its full weight on the page. Two `todo` leaves under one parent,
    # one of them blocked, is the whole difference the mark column has to draw.
    Then the node "knobs" is not blocked
    And the node "knobs" shows an empty checkbox

  Scenario: The waiting mark names what it is waiting on, without a hover
    # An `aria-label` rather than a tooltip alone: what a row is waiting on is
    # not information to hide behind a pointer. It names the blockers in the
    # order the format promises — and `handles`, which nobody marked, is not
    # among them.
    Then the waiting mark on "hinges" says "blocked by order the new cabinets"

  Scenario: What is finished, and what was never a task, hold nothing up
    # Two readings of one rule. `order` is `after` `demo` and `demo` is done,
    # so the way is clear. `hinges` is ALSO `after` `handles`, which nobody
    # marked — a bullet is not work, so there is nothing under it to finish and
    # nothing to wait for; the mark above says `hinges` waits on `order` and
    # says nothing about `handles`. Reading that edge as an obstacle is the
    # trap the rule is written against: it makes every plain bullet a thing
    # that can never be cleared.
    Then the node "order" is not blocked
    And the node "handles" is not blocked

  Scenario: A dated node shows a date badge
    Then the node "order" shows the date "2026-08-10"
    And the node "demo" shows no date

  Scenario: A description is one clamped line under the title by default
    # Full markdown is the zoomed page and click-to-expand — see
    # note_density.feature. Here the outline only promises the default shape.
    Then the description of "order" is a preview of "Two ways to go:"
    And the description of "order" does not render as markdown blocks

  Scenario: A hash-tag in a title is styled
    Then the title of "kitchen" styles the tag "home"
    # Styling the tag must not eat it: the title is stored verbatim, `#` and all.
    And the node "kitchen" has the title "kitchen remodel #home"

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

  Scenario: A leaf has nothing to collapse
    Then the node "handles" has no toggle

  Scenario: A mirror shows its target's subtree, inline and marked
    # `kitchen-herbs` lives in house.jsonl and points at `herbs` in
    # garden.jsonl — the one relation that crosses files.
    Then the node "kitchen-herbs" is marked as a mirror
    And the node "basil" is a child of "kitchen-herbs"
    And the node "mint" is a child of "kitchen-herbs"
    And there should be no page errors
