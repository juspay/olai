@share-scratch
@scratch:good
Feature: Splitting and merging a row
  The two keys that change how many rows there are without a verb of their own.
  `Enter` in the MIDDLE of a line cuts it in two; `Backspace` at the START of
  one joins it onto the row above. Which of the two readings `Enter` takes is
  decided by where the caret is in the sentence a person is already looking at
  — the same rule every outliner has, and Workflowy's own.

  Both are ONE op at the same write gate the agent's tools go through
  (`split_node` and `merge_node` are the same two ops), so a merge that moves
  four children and archives a record either happens whole or does not happen.
  `@scratch:` because they write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    # The exact-outline assertions count `demo` — finished — among the rows,
    # so the page is asked to keep its finished rows drawn.
    And I show the done nodes
    And I mark the page

  Scenario: Enter in the middle of a line cuts it in two
    When I click the title of "handles"
    And I put the caret after "choose"
    And I press "Enter"
    Then the node "handles" has the title "choose"
    And "house.olai" holds a node titled " the handles" under "install"
    # The caret follows the half that CAME OFF, at its head — those are the
    # words that moved, and they are what the person is still looking at.
    And the row being typed holds " the handles"
    And the caret is at offset 0
    And the row being typed is drawn immediately after "handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A split in the middle of a bullet with children stays on the next line
    # The defect: the head keeps its children, so the tail as the next SIBLING
    # landed below the whole subtree — the caret at the bottom of the page, a
    # screen away from the sentence it was just in. When the children are on
    # screen the tail is the head's FIRST CHILD instead, which is the very next
    # line a reader's eye is already on.
    When I click the title of "install"
    And I put the caret after "install"
    And I press "Enter"
    Then the node "install" has the title "install"
    And "house.olai" holds a node titled " the cabinets" under "install"
    And the row being typed holds " the cabinets"
    And the caret is at offset 0
    And the row being typed is drawn immediately after "install"
    And the node "handles" is a child of "install"
    And the page has not reloaded
    And there should be no page errors
    # And the way back is the very verb the gesture would use: the tail is a
    # first child, so the `merge` the undo replays is the parent join. The
    # record sits in the Trash, as either split's merge puts it.
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "install" has the title "install the cabinets"
    And "house.olai" holds no node titled " the cabinets"
    And "_olai/Trash.olai" holds a node titled " the cabinets"

  Scenario: The half that comes off is a bare bullet, and everything else stays
    # `install` carries an attached document, an `after` edge and three
    # children. All of them describe THAT node, so all of them stay with the
    # half that is still it — and the new row is a node nobody has said
    # anything about yet, which in this format means no mark at all.
    When I click the title of "install"
    And I put the caret after "install"
    And I press "Enter"
    Then the node "install" has the title "install"
    And the node "handles" is a child of "install"
    And the node "knobs" is a child of "install"
    And "house.olai" holds a bare node titled " the cabinets"

  Scenario: A split cuts around a selection, keeping what falls outside it
    When I click the title of "handles"
    And I select "the" in the line
    And I press "Enter"
    Then the node "handles" has the title "choose "
    And "house.olai" holds a node titled " handles"

  Scenario: Enter at the end of a line still opens the next one
    # The other reading of the same key, unchanged: there is nothing after the
    # caret, so there is nothing to split off.
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    And the node "handles" has the title "choose the handles"

  Scenario: Enter at the head of a line inserts a draft above
    # Workflowy's "make space": a blank above, the words stay. Still a draft,
    # still nothing on disk — a node needs a title — so nothing is written that
    # the ops layer would refuse.
    When I click the title of "handles"
    And I put the caret at the start of the line
    And I press "Enter"
    Then a new row is being typed
    And the row being typed is drawn immediately above the title of "handles"
    And the node "handles" has the title "choose the handles"

  Scenario: Backspace at the start joins the row onto the one above
    When I click the title of "knobs"
    And I put the caret at the start of the line
    And I press "Backspace"
    # The caret is IN the surviving row, so the page draws an editor where its
    # title would be — which is the whole point of the key, and why what the row
    # says is asked of the editor and of the file rather than of a title span.
    Then "house.olai" holds a node titled "pick the hingespick the knobs"
    And "house.olai" no longer holds the node "knobs"
    # A TRASH rather than a shredder: the record is in the archive with its id,
    # which is what makes the mark it carried recoverable and the whole thing
    # undoable.
    And "_olai/Trash.olai" holds the node "knobs"
    # The caret lands on the SEAM — the length of what the row above said —
    # which is where the two halves met.
    And the row being typed holds "pick the hingespick the knobs"
    And the caret is at offset 15
    # And what could not survive on the page is said out loud. `knobs` was
    # marked `todo`, the format allows one mark per node, and the row above has
    # its own answer — so the mark went to the Trash with the record, and a
    # person is told rather than left to notice.
    And the nudge says "kept its `todo` mark"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The children of a merged row are adopted, in order, by the row above
    # Nothing may be orphaned by a keystroke — and archiving them with their
    # parent would take a branch away that nobody asked about.
    Given I open the outline "garden.olai"
    # `glazing` and `sowing` arrive under `herbs` still wearing their done
    # marks, and the assertions count them — so this page is asked too.
    And I show the done nodes
    When I click the title of "frames"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then "garden.olai" holds a node titled "the herb bed by the doorthe cold frames"
    And the node "glazing" is a child of "herbs"
    And the node "slugs" is a child of "herbs"
    And the node "mint" comes before "glazing"
    And "garden.olai" no longer holds the node "frames"

  Scenario: The first of its siblings joins into the row ON the page above it — its parent
    # `Backspace` at offset zero is claimed as `merge` at the start of ANY
    # line, and `merging` used to refuse a first child outright — the dead
    # key the review of #493 met on the row the expanded-parent split makes.
    # The head is right there on screen; the join is the same join.
    When I click the title of "handles"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then the row being typed holds "install the cabinetschoose the handles"
    # The caret lands on the SEAM — the length of what the parent said.
    And the caret is at offset 20
    And the node "hinges" is a child of "install"
    And "house.olai" holds a node titled "install the cabinetschoose the handles"
    And "house.olai" no longer holds the node "handles"
    And the page has not reloaded

  Scenario: The top of the page has nothing above it to merge into
    When I click the title of "kitchen"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then the refusal says "no row above it to merge into"
    And the row being typed holds "kitchen remodel #home"
    And "house.olai" holds a node titled "kitchen remodel #home"
    # And the row goes on working, like every other refused key.
    When I select all and type "the kitchen remodel"
    And I click away from the editor
    Then "house.olai" holds a node titled "the kitchen remodel"

  Scenario: Backspace at the start of the split's tail undoes the split AT ONCE
    # The gesture a hand reaches for after an `Enter` it did not mean: the
    # split left the caret at offset zero of the tail — the one place the key
    # is `merge`, and the head it came off is the row directly above.
    When I click the title of "install"
    And I put the caret after "install"
    And I press "Enter"
    Then the row being typed holds " the cabinets"
    And the caret is at offset 0
    When I press "Backspace"
    Then the row being typed holds "install the cabinets"
    And the caret is at offset 7
    And "house.olai" holds a node titled "install the cabinets"
    And "house.olai" holds no node titled " the cabinets"
    And the page has not reloaded

  Scenario: Backspace anywhere else is the field's own
    # The one position the key is claimed at is the one where it has nothing of
    # its own to delete. Everywhere else it deletes a character, and the row is
    # still one row.
    When I click the title of "knobs"
    And I press "Backspace"
    Then the row being typed holds "pick the knob"
    And the node "hinges" has the title "pick the hinges"

  Scenario: A merge takes back a split, and ⌘Z takes back either
    When I click the title of "handles"
    And I put the caret after "choose"
    And I press "Enter"
    Then "house.olai" holds a node titled " the handles"
    # ⌘Z is dead while an editor is open — the input has the platform's own
    # undo in it — so the draft is dropped first, exactly as every other undo
    # scenario does it.
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And "house.olai" no longer holds a node titled " the handles"
    When I press "ControlOrMeta+Shift+z"
    Then the node "handles" has the title "choose"
    # And the redo is the whole write, not half of it: the tail is a record on
    # disk again, immediately after the head — which is the placement the
    # merge-as-inverse shape exists to get right.
    And "house.olai" holds a node titled " the handles" under "install"

  Scenario: ⌘Z after a merge brings the row back with its children
    # The one inverse on this surface that is a whole sequence: the record out
    # of the trash, back into its place, its children back under it, and the
    # survivor's title put back guarded by what the merge made it.
    Given I open the outline "garden.olai"
    And I show the done nodes
    When I click the title of "frames"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then "garden.olai" no longer holds the node "frames"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "herbs" has the title "the herb bed by the door"
    And "garden.olai" holds the node "frames"
    And the node "glazing" is a child of "frames"
    And the node "sowing" is a child of "frames"
    And the node "herbs" comes before "frames"

  Scenario: ⌘Z after a merge brings the mark back out of the Trash with it
    # The other half of the promise the nudge makes. `knobs` is marked `todo`;
    # merging it puts that mark in the Trash with the record rather than
    # destroying it, so the way back has to bring it out again — which is what
    # `unarchive` restoring the record intact means, and the mark is the field
    # that says so.
    When I click the title of "knobs"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then "house.olai" no longer holds the node "knobs"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "knobs" has status "todo"
    And the node "hinges" has the title "pick the hinges"
    And the node "hinges" comes before "knobs"

  Scenario: A split at a mirror is refused, in the ops layer's own words
    # A split puts a SECOND ROW on the page, so it names the row's own record
    # like a merge does — and a placement is not a node. Named through the
    # mirror instead, the tail would be minted beside `herbs` in `garden.olai`:
    # a mirror draws its target's children and never its siblings, so the two
    # halves of one sentence would stop being siblings on screen and the caret
    # would follow the tail off the page.
    When I click the title of "kitchen-herbs"
    And I put the caret after "the herb bed"
    And I press "Enter"
    Then the refusal says "is a mirror"
    And "garden.olai" holds a node titled "the herb bed by the door"
    And "garden.olai" holds no node titled " by the door"
    # And the row goes on working: the refusal wrote nothing and the caret is
    # still where it was.
    And the row being typed holds "the herb bed by the door"

  Scenario: Backspace at the start of a row that is still a draft writes it, then joins it
    # The ordinary "I meant this on the previous line" gesture. The key is
    # claimed at offset zero, so it is this feature's to answer — and a merge
    # joins the two titles the SET holds, so the line has to be written before
    # it can be joined onto anything. That is the same order every structural
    # key follows.
    When I click the title of "hinges"
    And I press "Enter"
    And I type "and the soft-close ones"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then "house.olai" holds a node titled "pick the hingesand the soft-close ones"
    And the caret is at offset 15

  Scenario: Backspace at the start of an EMPTY draft still writes nothing
    # The other half of the case above, and it is not a regression: an empty
    # new row is not a node, so there is nothing to join — the key does what the
    # field's own Backspace at offset zero always did there, which is nothing.
    When I click the title of "hinges"
    And I press "Enter"
    And I press "Backspace"
    Then a new row is being typed
    And the node "hinges" has the title "pick the hinges"
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"
