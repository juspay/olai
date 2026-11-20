@corpus:good
Feature: See the outline
  Opening an outline shows its tree. Almost everything on screen is DERIVED
  rather than stored — a parent's status, the tags inside a title, the subtree
  a mirror stands for — so these scenarios are as much about the derivation
  being right as about the pixels: `kitchen` says nothing about itself on disk,
  and the view has to work out that it is `doing` from its three children.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes

  Scenario: The tree shows the outline's nodes
    Then the tree is shown
    And the node "kitchen" is shown
    And the node "demo" is a child of "kitchen"
    And the node "handles" is a child of "install"

  Scenario: A node waiting on unfinished work says so in the mark column
    Then the node "hinges" is blocked by "order"
    And the node "hinges" has status "todo"
    And the node "hinges" shows the waiting mark
    And the node "hinges" shows no checkbox

  Scenario: The mark column says what it means in words as well as in a shape
    Then the mark column of "demo" is named "Done, zoom in"
    And the mark column of "hinges" is named "blocked by order the new cabinets, zoom in"
    And the mark column of "handles" is named "Zoom in"

  Scenario: A row is its title, and a pilcrow says there is more
    When I read the outline with Notes on "compact"
    Then the node "order" shows a pilcrow
    And the node "order" draws nothing under its title

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

  Scenario: A mirror shows its target's subtree, inline and marked
    Then the node "kitchen-herbs" is marked as a mirror
    And the node "basil" is a child of "kitchen-herbs"
    And the node "mint" is a child of "kitchen-herbs"
    And there should be no page errors

  Scenario: A section heading holds the seam while its branch scrolls
    Given the window is shorter than the page
    And I read the outline with Notes on "open"
    When I scroll to the end of the outline
    Then the section heading of "kitchen" is pinned under the main-column chrome
    And the row "demo" is not pinned under the main-column chrome
    And there should be no page errors
