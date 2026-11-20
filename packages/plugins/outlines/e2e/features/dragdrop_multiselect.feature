@share-scratch
@scratch:good
Feature: Dragging rows, and picking several
  Workflowy's two pointer gestures, on top of the keyboard loop `self-edit`
  shipped: drag a bullet to move a row with everything under it, and pick a run
  of rows to complete, indent, move or put away in one go.

  Neither is a new kind of write. A drop is the surface's own `place` — the
  parent and the sibling to sit after, which is the `outlines_move` an agent would
  send — and a bulk verb is the edit the single-row key already sends, once per
  row, in the order that produces the shape asked for. So these are `@scratch:`
  for the reason the keyboard's are: they write the directory they are served.
  They share one copy per worker (`@share-scratch`); the corpus is restored
  between scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: The line says where a row will land before you let go
    When I pick up the bullet of "knobs" and hold it above the title of "handles"
    Then the drop line would put it under "install"
    And the drop line would put it first
    When I let go
    Then the node "knobs" is a child of "install"
    And the node "knobs" comes before "handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A drop one step in makes the row a child of the one above
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
    When I pick up the bullet of "knobs" and hold it far inside the title of "kitchen-herbs"
    Then the drop line would put it under "kitchen"
    And the drop line would put it after "kitchen-herbs"
    When I let go
    Then the node "knobs" is a child of "kitchen"
    And nothing is said about the pick
    And there should be no page errors

  Scenario: A mirror's own children are not places for THIS file's rows
    When I pick up the bullet of "knobs" and hold it above the title of "mint"
    Then the drop line would put it under "kitchen"
    And the drop line would put it after "kitchen-herbs"
    When I let go
    Then the node "knobs" is a child of "kitchen"
    And "house.olai" holds the node "knobs"
    And nothing is said about the pick
    And there should be no page errors

  Scenario: A branch is never offered a place inside itself
    When I pick up the bullet of "install" and hold it above the title of "knobs"
    Then the drop line names nothing under "install"
    When I let go
    Then there should be no page errors

  Scenario: Pressing a bullet without moving still zooms into it
    When I click the bullet of "install"
    Then the zoomed node is "install"

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
    When I pick the title of "handles"
    And I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    And no rows are picked

  Scenario: Ctrl+Enter ticks off every row in the pick
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    And I press "Control+Enter"
    Then the node "handles" has status "done"
    And the node "hinges" has status "done"
    And the node "knobs" has status "done"
    And there should be no page errors

  Scenario: Tab indents the pick and keeps its order, and Shift+Tab puts it back
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
    When I pick the title of "handles"
    And I press "Tab"
    Then the pick says "no row above to indent under"
    And the node "handles" is a child of "install"

  Scenario: One gesture, N inverses — ⌘Z walks a bulk indent back a row at a time
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
    When I pick the title of "install"
    And I press the Trash
    Then the question names "3 rows under it"
    When I press "Escape"
    And I pick the title of "install"
    Then the pick offers the Trash
    And the pick is not asking anything
    When I press "Escape"
    And I pick the title of "handles"
    And I press the Trash
    Then the question names "this row"
    When I shift-click the title of "knobs"
    Then the pick is not asking anything
    And 3 rows are picked

  Scenario: A placement in the pick is said out loud rather than skipped
    When I pick the title of "kitchen-herbs"
    Then the pick does not offer the Trash
    And the pick notes "A mirrored row is selected"

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
    When I select text across the title of "order"
    Then the words are selected
    And no band is drawn
    And no rows are picked
    When I let go
    Then there should be no page errors

  Scenario: A ROOT row has a rail beside it too
    When I sweep from beside "kitchen" down to "order"
    Then the band is crossing 3 rows
    And 1 rows are picked
    And the row "kitchen" is picked
    When I let go
    Then there should be no page errors

  Scenario: The page below the last row is somewhere to start
    When I sweep from below the outline up to "install"
    Then 2 rows are picked
    And the row "install" is picked
    And the row "kitchen-herbs" is picked

  Scenario: Pressing the page without pulling puts the pick away
    When I pick the title of "handles"
    And I shift-click the title of "knobs"
    Then 3 rows are picked
    When I press below the outline
    Then no rows are picked

  Scenario: A row held at the bottom of the window takes the page with it
    Given the window is shorter than the outline
    When I pick up the bullet of "demo" and hold it at the bottom of the window
    Then the outline has scrolled
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
