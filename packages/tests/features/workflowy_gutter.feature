@corpus:good
Feature: Workflowy gutter
  The outline gutter matches Workflowy: a filled bullet, a gray halo when
  children are hidden, a hover-reveal `•••` menu and collapse triangle left of
  the bullet, and a menu of read-only actions the client can already perform.

  Background:
    Given I open the outline "house.jsonl"

  Scenario: A collapsed parent shows the halo on its bullet
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the node "kitchen" shows a collapsed halo
    And the children of "kitchen" are hidden

  Scenario: Expanding clears the halo
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    And I expand the node "kitchen"
    Then the node "kitchen" shows no collapsed halo

  Scenario: A leaf never has a halo
    Then the node "handles" shows no collapsed halo
    And the node "handles" has no toggle

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

  Scenario: The node menu offers only the five read actions
    When I open the node menu of "kitchen"
    Then the node menu offers exactly:
      | Zoom in            |
      | Collapse           |
      | Expand all         |
      | Collapse all       |
      | Copy link to node  |

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
