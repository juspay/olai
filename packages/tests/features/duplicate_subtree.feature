@scratch:good
Feature: Duplicating a subtree
  One gesture copies a node and everything under it as the sibling below —
  `duplicate_node` for an agent, `Duplicate` in the row's ••• menu and ⌘⇧D for
  a person, all three the SAME op through the same write gate.

  What the op promises is short enough to hold in one sentence: the copy is a
  second THING and not a second claim on the first. Every id in it is fresh;
  every other field comes across verbatim, the marks and their instants
  included; a reference the subtree made to itself follows the copy, and one
  that left the subtree keeps the target it always had. A mirror under the copy
  is copied as a MIRROR — the placement, not the identity — so the copied list
  shows the same node rather than a twin of it.

  `@scratch:` because these write the directory they are served: each scenario
  gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The menu copies the row and everything under it
    # `install the cabinets` has three children, a `doc`, two marked rows and
    # an `after` edge pointing out of the subtree — which is most of what the
    # format can put on a record, and all of it is asserted below rather than
    # sampled.
    When I open the node menu of "install"
    Then the node menu offers "Duplicate"
    When I choose "Duplicate" from the node menu
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And the copy of "install" in "house.olai" repeats every field but the ids and the stamps
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘⇧D is the same op, from the keyboard
    # The chord is Workflowy's own, and the SHIFT is what keeps bare ⌘D the
    # bookmark key every browser has trained every reader on.
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+d"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And there should be no page errors

  Scenario: The copy carries the marks it copied, instants and all
    # THE DECISION, asserted rather than described: a `todo` stays a `todo` and
    # a `done` keeps the day it was stamped on. Every alternative invents a
    # claim nobody made — that the copy was never a task, that it was finished
    # today, that it has not started — and a copy that says something its
    # original does not is not a copy.
    #
    # `take out the old counters` is done, dated 2026-08-03, and the two rows
    # under `install the cabinets` are `todo`. The field-for-field step is what
    # holds all of it, over the whole kitchen.
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "kitchen" with fresh ids throughout
    And the copy of "kitchen" in "house.olai" repeats every field but the ids and the stamps

  Scenario: An edge inside the copy follows the copy; one that leaves it does not
    # The rule with two halves, in one record: `pick the hinges` waits on
    # `handles` — inside the subtree being copied — and on `order`, which is
    # not. So the copied row waits on the COPY of the handles and on the same
    # `order` the original waits on. Anything else makes the copy reach back
    # into the original, or makes it wait on something that was never copied.
    When I open the node menu of "install"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "install" with fresh ids throughout
    And in the copy of "install" in "house.olai", "hinges" waits on the copy of "handles" and on "order"
    And "house.olai" holds the node "hinges" after "handles, order"

  Scenario: A mirror under the copy is copied as a placement, showing the same node
    # `kitchen-herbs` is a placement of a node in ANOTHER file. Copying the
    # kitchen copies the line, not the herb bed: the copy is a mirror record
    # with a fresh id of its own and the same target, and `garden.olai` is
    # untouched.
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "kitchen" with fresh ids throughout
    And the copy of "kitchen" in "house.olai" places a mirror of "herbs"
    And "garden.olai" holds exactly 1 node titled "the herb bed by the door"

  Scenario: A placement offers no Duplicate — retiring the line is what it offers
    # The same split the put-away makes: copying through a mirror would write a
    # subtree into the file its target lives in, out of sight of the row that
    # was clicked.
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen-herbs"
    Then the node menu does not offer "Duplicate"
    And the node menu offers "Remove this placement"

  Scenario: ⌘Z puts the copy in the Trash, and ⌘⇧Z brings it back
    # An undo takes back what THIS write made, and what a duplicate makes is a
    # branch — so the way back is the archive, which is the only removal the
    # set has. The original is untouched by both.
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+d"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    # Escape takes the caret out of the row, which is what makes the chord the
    # page's rather than the input's.
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds exactly 1 node titled "install the cabinets"
    And "house.olai" holds the node "install"
    And "_olai/Trash.olai" holds a node titled "install the cabinets"
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And there should be no page errors
