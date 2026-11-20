@share-scratch
@scratch:good
Feature: Duplicating a subtree
  One gesture copies a node and everything under it as the sibling below —
  `outlines_duplicate` for an agent, `Duplicate` in the row's ••• menu and ⌘⇧D for
  a person, all three the SAME op through the same write gate.

  What the op promises is short enough to hold in one sentence: the copy is a
  second THING and not a second claim on the first. Every id in it is fresh;
  every other field comes across verbatim, the marks and their instants
  included; a reference the subtree made to itself follows the copy, and one
  that left the subtree keeps the target it always had. A mirror under the copy
  is copied as a MIRROR — the placement, not the identity — so the copied list
  shows the same node rather than a twin of it.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The menu copies the row and everything under it
    When I open the node menu of "install"
    Then the node menu offers "Duplicate"
    When I choose "Duplicate" from the node menu
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And the copy of "install" in "house.olai" repeats every field but the ids and the stamps
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘⇧D is the same op, from the keyboard
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+d"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And "house.olai" holds a copy of "install" with fresh ids throughout
    And there should be no page errors

  Scenario: The copy carries the marks it copied, instants and all
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "kitchen" with fresh ids throughout
    And the copy of "kitchen" in "house.olai" repeats every field but the ids and the stamps

  Scenario: An edge inside the copy follows the copy; one that leaves it does not
    When I open the node menu of "install"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "install" with fresh ids throughout
    And in the copy of "install" in "house.olai", "hinges" waits on the copy of "handles" and on "order"
    And "house.olai" holds the node "hinges" after "handles, order"

  Scenario: A mirror under the copy is copied as a placement, showing the same node
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "Duplicate" from the node menu
    Then "house.olai" holds a copy of "kitchen" with fresh ids throughout
    And the copy of "kitchen" in "house.olai" places a mirror of "herbs"
    And "garden.olai" holds exactly 1 node titled "the herb bed by the door"

  Scenario: A placement offers no Duplicate — retiring the line is what it offers
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen-herbs"
    Then the node menu does not offer "Duplicate"
    And the node menu offers "More › Remove from here"

  Scenario: ⌘Z puts the copy in the Trash, and ⌘⇧Z brings it back
    When I click the title of "install"
    And I press "ControlOrMeta+Shift+d"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds exactly 1 node titled "install the cabinets"
    And "house.olai" holds the node "install"
    And "_olai/Trash.olai" holds a node titled "install the cabinets"
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds exactly 2 nodes titled "install the cabinets"
    And there should be no page errors
