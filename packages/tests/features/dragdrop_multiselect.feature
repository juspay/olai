@scratch:good
Feature: Dragging rows, and picking several
  Workflowy's two pointer gestures, on top of the keyboard loop `self-edit`
  shipped: drag a bullet to move a row with everything under it, and pick a run
  of rows to complete, indent, move or put away in one go.

  Neither is a new kind of write. A drop is the surface's own `place` — the
  parent and the sibling to sit after, which is the `move_node` an agent would
  send — and a bulk verb is the edit the single-row key already sends, once per
  row, in the order that produces the shape asked for. So these are `@scratch:`
  for the reason the keyboard's are: they write the directory they are served,
  and each gets a private copy of it (`support/hooks.ts`).

  Background:
    Given I open the outline "house.jsonl"
    And I mark the page

  # ── dragging one row ─────────────────────────────────────────────────

  Scenario: The line says where a row will land before you let go
    # The whole affordance, and it has to answer two questions at once: which
    # gap, and how far in. Held above the first child of `install`, it promises
    # that parent and the front of it — which is a promise a scenario can hold
    # while the pointer is still down, and the only moment it is a prediction
    # rather than a file.
    When I pick up the bullet of "knobs" and hold it above the title of "handles"
    Then the drop line would put it under "install"
    And the drop line would put it first
    When I let go
    Then the node "knobs" is a child of "install"
    And the node "knobs" comes before "handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A drop one step in makes the row a child of the one above
    # The gap between `order` and `install` reads the same to the eye whether a
    # row is joining `kitchen`'s children or becoming `order`'s last one, which
    # is why the pointer's x is read at all.
    When I pick up the bullet of "knobs" and hold it one step in under the title of "order"
    Then the drop line would put it under "order"
    When I let go
    Then the node "knobs" is a child of "order"

  Scenario: A row takes everything under it
    When I drag the bullet of "install" one step in under the title of "order"
    Then the node "install" is a child of "order"
    And the node "handles" is a child of "install"
    And the node "knobs" is a child of "install"

  Scenario: A branch is never offered a place inside itself
    # Not a guard but a construction: the rows being carried are left out of the
    # ones a drop can land beside, so there is no gesture that asks the ops
    # layer to make a loop.
    When I pick up the bullet of "install" and hold it above the title of "knobs"
    Then the drop line names nothing under "install"
    When I let go
    Then there should be no page errors

  Scenario: Pressing a bullet without moving still zooms into it
    # The bullet is a link and a handle, and what tells the two apart is
    # whether the pointer travelled.
    When I click the bullet of "install"
    Then the zoomed node is "install"

  # ── picking a run ────────────────────────────────────────────────────

  Scenario: Click one title and shift-click another to pick the run between
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    Then 3 rows are picked
    And the row "handles" is picked
    And the row "hinges" is picked
    And the row "knobs" is picked

  Scenario: A modifier-click adds one row, and takes it back out
    When I pick the title of "handles"
    And I pick the title of "knobs"
    Then 2 rows are picked
    And the row "hinges" is not picked
    When I pick the title of "knobs"
    Then 1 rows are picked

  Scenario: A parent and its child are ONE row to a verb
    # What a bulk verb is asked of is the picked rows nothing else picked
    # contains — a subtree moves whole, so an op for the child as well would be
    # an op about a row that has already moved with its parent.
    When I pick the title of "install"
    And I shift-click the title of "knobs"
    Then 1 rows are picked
    And the row "knobs" is picked

  Scenario: Shift+arrow leaves the caret and starts picking rows
    When I click the title of "handles"
    And I press "Shift+ArrowDown"
    Then 2 rows are picked
    And no row is being edited
    # ...and the ladder carries on from there: ⌘A takes the rows beside them.
    When I press "Control+a"
    Then 3 rows are picked

  Scenario: A plain click puts the pick away and the caret back in
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    And I click the title of "hinges"
    Then no rows are picked
    And the row "hinges" holds the caret

  Scenario: Escape puts the pick away
    When I pick the title of "handles"
    And I press "Escape"
    Then no rows are picked

  # ── what a pick answers to ───────────────────────────────────────────

  Scenario: Ctrl+Enter ticks off every row in the pick
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    And I press "Control+Enter"
    Then the node "handles" has status "done"
    And the node "hinges" has status "done"
    And the node "knobs" has status "done"
    And there should be no page errors

  Scenario: Tab indents the pick and keeps its order, and Shift+Tab puts it back
    # The order the ops go out in IS the shape they produce: `hinges` goes under
    # the row above it, and `knobs`'s row above is then that same row — so it
    # follows `hinges` under it rather than landing under `hinges`.
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    And I press "Tab"
    Then the node "hinges" is a child of "handles"
    And the node "knobs" is a child of "handles"
    And the node "hinges" comes before "knobs"
    When I press "Shift+Tab"
    Then the node "hinges" is a child of "install"
    And the node "knobs" is a child of "install"
    And the node "hinges" comes before "knobs"

  Scenario: Alt+Shift+Up moves the whole pick among its siblings
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    And I press "Alt+Shift+ArrowUp"
    Then the node "hinges" comes before "handles"
    And the node "knobs" comes before "handles"
    And the node "hinges" comes before "knobs"

  Scenario: Dragging one of a pick carries all of them
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    And I drag the bullet of "knobs" above the title of "handles"
    Then the node "hinges" comes before "handles"
    And the node "knobs" comes before "handles"
    And the node "hinges" comes before "knobs"

  Scenario: A refused bulk write says so in the ops layer's own words, and stops
    # `handles` is the first of its siblings, so there is nothing above it to go
    # under — the same refusal the key gets on one row, on the bar instead of
    # under a caret that is not there.
    When I pick the title of "handles"
    And I press "Tab"
    Then the pick says "no row above it"
    And the node "handles" is a child of "install"

  # ── the one verb with no key ─────────────────────────────────────────

  Scenario: Move to Trash asks first, and names how much goes
    When I pick the title of "install"
    Then the pick offers the Trash
    When I press the Trash
    Then the question names "3 rows under it"
    When I press the Trash
    Then the node "install" is not shown
    And "Archive.jsonl" holds the node "install"
    And "Archive.jsonl" holds the node "knobs"

  Scenario: A placement in the pick is said out loud rather than skipped
    # The node a mirror shows lives in another file, so this face will not put
    # it away from here — the same rule the `•••` menu keeps by not offering
    # `Move to Trash` on a mirror at all.
    When I pick the title of "kitchen-herbs"
    Then the pick does not offer the Trash
    And the pick notes "a placement is in the pick"
