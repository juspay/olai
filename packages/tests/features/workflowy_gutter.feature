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

  Scenario: Hovering a row reveals the menu and the collapse control
    Given the node "kitchen" is expanded
    When I hover the node "kitchen"
    Then the node menu of "kitchen" is revealed
    And the collapse control of "kitchen" is revealed

  Scenario: The node menu offers only read actions
    When I open the node menu of "kitchen"
    Then the node menu offers "Zoom in"
    And the node menu offers "Collapse"
    And the node menu offers "Expand all"
    And the node menu offers "Collapse all"
    And the node menu offers "Copy link to node"

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
