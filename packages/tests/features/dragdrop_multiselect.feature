@share-scratch
@scratch:good
Feature: Dragging rows, and picking several
  Workflowy's two pointer gestures, on top of the keyboard loop `self-edit`
  shipped: drag a bullet to move a row with everything under it, and pick a run
  of rows to complete, indent, move or put away in one go.

  Neither is a new kind of write. A drop is the surface's own `place` — the
  parent and the sibling to sit after, which is the `move_node` an agent would
  send — and a bulk verb is the edit the single-row key already sends, once per
  row, in the order that produces the shape asked for. So these are `@scratch:`
  for the reason the keyboard's are: they write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios.

  Background:
    Given I open the outline "house.olai"
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

  Scenario: A mirror is a line to drop BESIDE, never one to drop INTO
    # The drawn tree is not the placement tree. A placement has no children of
    # its own — what hangs under it belongs to the node it shows — so naming its
    # record as a parent is a request the ops layer always refuses. The pointer
    # cannot ask for it: held as far right as it goes, the line still promises
    # the level the mirror is drawn at, and the drop lands beside it.
    When I pick up the bullet of "knobs" and hold it far inside the title of "kitchen-herbs"
    Then the drop line would put it under "kitchen"
    And the drop line would put it after "kitchen-herbs"
    When I let go
    Then the node "knobs" is a child of "kitchen"
    And nothing is said about the pick
    And there should be no page errors

  Scenario: A mirror's own children are not places for THIS file's rows
    # Those rows are records of another outline, drawn here because a mirror
    # expands. A parent is same-file by the format, so there is no landing for a
    # `house.olai` row among them — they are not candidates at all, so a
    # pointer held over one lands beside the MIRROR, in this file, where the
    # write can actually go.
    When I pick up the bullet of "knobs" and hold it above the title of "mint"
    Then the drop line would put it under "kitchen"
    And the drop line would put it after "kitchen-herbs"
    When I let go
    Then the node "knobs" is a child of "kitchen"
    And "house.olai" holds the node "knobs"
    And nothing is said about the pick
    And there should be no page errors

  Scenario: A branch is never offered a place inside itself
    # Not a guard but a construction: the rows being carried are left out of the
    # ones a drop can land beside, so there is no gesture that asks the ops
    # layer to make a loop. The predicate is `select/range.test.ts`; this is
    # the live drag filtering the gap list by it, which no unit file pins.
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

  Scenario: Clicking a NOTE puts the pick away too
    # The invariant is "a caret or a pick, never both", and it is what lets the
    # bulk keys be the row keys. The title honoured it and the note did not, so
    # a caret could sit in a textarea — where `Tab` is the field's — while the
    # bar still claimed rows were picked.
    When I pick the title of "handles"
    And I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    And no rows are picked

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

  # ── taking one back ──────────────────────────────────────────────────

  Scenario: One gesture, N inverses — ⌘Z walks a bulk indent back a row at a time
    # A bulk verb is the single-row op repeated, so what it leaves on the undo
    # stack is N entries rather than one. That is the same thing MCP leaves
    # behind for the same work, and it is the honest consequence of "exactly as
    # if the key had been pressed once per row" — including that ONE ⌘Z leaves
    # the half-indent the refusal path refuses to leave. Pinned rather than
    # described, because a reader will otherwise expect one press to undo one
    # gesture.
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    And I press "Tab"
    Then the node "hinges" is a child of "handles"
    And the node "knobs" is a child of "handles"
    When I press "ControlOrMeta+z"
    Then the node "knobs" is a child of "install"
    And the node "hinges" is a child of "handles"
    When I press "ControlOrMeta+z"
    Then the node "hinges" is a child of "install"
    And the node "hinges" comes before "knobs"

  Scenario: …and back a row at a time after a drop of two
    When I pick the title of "hinges"
    And I shift-click the title of "knobs"
    And I drag the bullet of "knobs" above the title of "handles"
    Then the node "hinges" comes before "handles"
    And the node "knobs" comes before "handles"
    When I press "ControlOrMeta+z"
    And I press "ControlOrMeta+z"
    Then the node "handles" comes before "hinges"
    And the node "hinges" comes before "knobs"
    And there should be no page errors

  # ── the one verb with no key ─────────────────────────────────────────

  Scenario: Move to Trash asks first, and names how much goes
    When I pick the title of "install"
    Then the pick offers the Trash
    When I press the Trash
    Then the question names "3 rows under it"
    When I press the Trash
    Then the node "install" is not shown
    And "_olai/Trash.olai" holds the node "install"
    And "_olai/Trash.olai" holds the node "knobs"

  Scenario: The question does not outlive the rows it is about
    # `asking` is a signal on a bar that is always mounted, so putting the pick
    # away used to leave the confirm armed: the next pick opened already asking,
    # and a second press of the button that OPENED the question last time
    # archived instead.
    When I pick the title of "install"
    And I press the Trash
    Then the question names "3 rows under it"
    When I press "Escape"
    And I pick the title of "install"
    Then the pick offers the Trash
    And the pick is not asking anything
    # ...and changing the pick while it IS asking resets it too, because that is
    # a different question about a different subtree.
    When I press "Escape"
    And I pick the title of "handles"
    And I press the Trash
    Then the question names "this row"
    When I shift-click the title of "knobs"
    Then the pick is not asking anything
    And 3 rows are picked

  Scenario: A placement in the pick is said out loud rather than skipped
    # The node a mirror shows lives in another file, so this face will not put
    # it away from here — the same rule the `•••` menu keeps by not offering
    # `Move to Trash` on a mirror at all.
    When I pick the title of "kitchen-herbs"
    Then the pick does not offer the Trash
    And the pick notes "a placement is in the pick"

  # ── the fifth picking gesture: drag across ───────────────────────────
  #
  # #159 shipped four of Workflowy's five and left this one, because a marquee
  # over a tree that also has native text selection in it is a design rather
  # than a feature: press-and-pull already MEANS something, and shipping a
  # second meaning for it is deciding which of the two a given pull is.
  #
  # The decision is one sentence — WHERE THE PULL BEGINS decides — and the
  # scenarios below are its halves: begun on the words it is text, begun on the
  # outline's own scaffolding it is a pick, and where the scaffolding IS is the
  # rail beside a branch and the page under the last row.

  Scenario: Sweeping down the rail picks the rows the pull crosses
    When I sweep from beside "demo" down to "install"
    Then the band is crossing 3 rows
    And 3 rows are picked
    And the row "demo" is picked
    And the row "order" is picked
    And the row "install" is picked
    When I let go
    Then no band is drawn
    And 3 rows are picked
    And there should be no page errors

  Scenario: A pull begun in the words is the browser's, and picks nothing
    # The tension this gesture had to settle, held as the thing that would be
    # LOST if it were settled the other way: a reader must still be able to
    # sweep a title and quote it. The pull travels down past the row it started
    # in, which is exactly the shape a marquee would have claimed.
    When I select text across the title of "order"
    Then the words are selected
    And no band is drawn
    And no rows are picked
    When I let go
    Then there should be no page errors

  Scenario: A ROOT row has a rail beside it too
    # A nested list gives its branch one for free — the padding a child list
    # indents by is scaffolding a person can press. The outline's own list was
    # flush, so beside a root row the only empty space was the four pixels
    # between two lines: on a flat inbox, the one sweep the gesture could not
    # make was a prefix of it, which is the first thing a Workflowy hand tries
    # (review, 2026-08-14). The rail is taken out of the pane's own padding, so
    # it exists at depth 0 and nothing moved.
    When I sweep from beside "kitchen" down to "order"
    Then the band is crossing 3 rows
    # One row to a verb: `order` and `demo` are drawn under `kitchen`, and a
    # subtree moves whole.
    And 1 rows are picked
    And the row "kitchen" is picked
    When I let go
    Then there should be no page errors

  Scenario: The page below the last row is somewhere to start
    # A short outline leaves most of the pane empty, and that is the sweep's
    # largest surface — without it a tree with no depth would have nothing but
    # the gaps between lines to press.
    When I sweep from below the outline up to "install"
    # Everything from `install` to the foot of the tree, which is what pulling
    # up from under it crosses — and two rows to a verb, because the mirror's
    # expanded children come along inside it.
    Then 2 rows are picked
    And the row "install" is picked
    And the row "kitchen-herbs" is picked

  Scenario: Pressing the page without pulling puts the pick away
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    Then 3 rows are picked
    When I press below the outline
    Then no rows are picked

  # ── the page keeps up with a gesture ─────────────────────────────────
  #
  # Both gestures aim at ROWS, and an outline is longer than a window nearly
  # always — so without this the reach of either is "whatever was on screen
  # when the press landed". The WINDOW is what shrinks here, because the
  # corpora in this suite are outlines a person can read inside a scenario.

  Scenario: A row held at the bottom of the window takes the page with it
    Given the window is shorter than the outline
    When I pick up the bullet of "demo" and hold it at the bottom of the window
    Then the outline has scrolled
    # ...and the landing is re-read from where the pointer is ON THE PAGE, which
    # has moved under a pointer that has not: the last row of the file is only
    # nameable at all because the page came to it.
    And the drop line would put it after "kitchen-herbs"
    When I let go
    Then the node "kitchen-herbs" comes before "demo"
    And there should be no page errors

  Scenario: A sweep held at the bottom of the window takes it too
    Given the window is shorter than the outline
    When I sweep from beside "demo" to the bottom of the window
    Then the outline has scrolled
    And the row "kitchen-herbs" is picked
    When I let go
    Then there should be no page errors
