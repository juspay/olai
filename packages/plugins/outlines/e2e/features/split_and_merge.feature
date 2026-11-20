@share-scratch
@scratch:good
Feature: Splitting and merging a row
  The two keys that change how many rows there are without a verb of their own.
  `Enter` in the MIDDLE of a line cuts it in two; `Backspace` at the START of
  one joins it onto the row above. Which of the two readings `Enter` takes is
  decided by where the caret is in the sentence a person is already looking at
  — the same rule every outliner has, and Workflowy's own.

  Both are ONE op at the same write gate the agent's tools go through
  (`outlines_split` and `outlines_merge` are the same two ops), so a merge that moves
  four children and archives a record either happens whole or does not happen.
  `@scratch:` because they write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I mark the page

  Scenario: Enter in the middle of a line cuts it in two
    When I click the title of "handles"
    And I put the caret after "choose"
    And I press "Enter"
    Then the node "handles" has the title "choose"
    And "house.olai" holds a node titled " the handles" under "install"
    And the row being typed holds " the handles"
    And the caret is at offset 0
    And the row being typed is drawn immediately after "handles"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A split in the middle of a bullet with children stays on the next line
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
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "install" has the title "install the cabinets"
    And "house.olai" holds no node titled " the cabinets"
    And "_olai/Trash.olai" holds a node titled " the cabinets"

  Scenario: The half that comes off is a bare bullet, and everything else stays
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
    When I click the title of "handles"
    And I press "Enter"
    Then a new row is being typed
    And the node "handles" has the title "choose the handles"

  Scenario: Enter at the head of a line inserts a draft above
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
    Then "house.olai" holds a node titled "pick the hingespick the knobs"
    And "house.olai" no longer holds the node "knobs"
    And "_olai/Trash.olai" holds the node "knobs"
    And the row being typed holds "pick the hingespick the knobs"
    And the caret is at offset 15
    And the nudge says "kept its `todo` mark"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The children of a merged row are adopted, in order, by the row above
    Given I open the outline "garden.olai"
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
    When I click the title of "handles"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then the row being typed holds "install the cabinetschoose the handles"
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
    When I select all and type "the kitchen remodel"
    And I click away from the editor
    Then "house.olai" holds a node titled "the kitchen remodel"

  Scenario: Backspace at the start of the split's tail undoes the split AT ONCE
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
    When I click the title of "knobs"
    And I press "Backspace"
    Then the row being typed holds "pick the knob"
    And the node "hinges" has the title "pick the hinges"

  Scenario: A merge takes back a split, and ⌘Z takes back either
    When I click the title of "handles"
    And I put the caret after "choose"
    And I press "Enter"
    Then "house.olai" holds a node titled " the handles"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And "house.olai" no longer holds a node titled " the handles"
    When I press "ControlOrMeta+Shift+z"
    Then the node "handles" has the title "choose"
    And "house.olai" holds a node titled " the handles" under "install"

  Scenario: ⌘Z after a merge brings the row back with its children
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
    When I click the title of "kitchen-herbs"
    And I put the caret after "the herb bed"
    And I press "Enter"
    Then the refusal says "is a mirror"
    And "garden.olai" holds a node titled "the herb bed by the door"
    And "garden.olai" holds no node titled " by the door"
    And the row being typed holds "the herb bed by the door"

  Scenario: Backspace at the start of a row that is still a draft writes it, then joins it
    When I click the title of "hinges"
    And I press "Enter"
    And I type "and the soft-close ones"
    And I put the caret at the start of the line
    And I press "Backspace"
    Then "house.olai" holds a node titled "pick the hingesand the soft-close ones"
    And the caret is at offset 15

  Scenario: Backspace at the start of an EMPTY draft deletes the draft and aims above
    When I click the title of "hinges"
    And I press "Enter"
    And I press "Backspace"
    Then the row being typed holds "pick the hinges"
    And the caret is at offset 15
    And the outline "house.olai" shows exactly the nodes "kitchen, demo, order, install, handles, hinges, knobs, kitchen-herbs"

  Scenario: Erasing a title and Backspacing the empty line takes the row away
    When I click the title of "handles"
    And I select all and type ""
    And I press "Backspace"
    Then the row being typed holds "install the cabinets"
    And the caret is at offset 20
    And "house.olai" holds a node titled "install the cabinets"
    And "house.olai" no longer holds the node "handles"
    And "_olai/Trash.olai" holds the node "handles"
    When I click away from the editor
    And I press "ControlOrMeta+z"
    Then the node "handles" has the title "choose the handles"
    And the node "handles" comes before "hinges"
    And there should be no page errors
