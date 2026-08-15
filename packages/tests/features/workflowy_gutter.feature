@corpus:good
Feature: Workflowy gutter
  The outline gutter matches Workflowy: a filled bullet, a gray halo when
  children are hidden, a hover-reveal `•••` menu and collapse triangle left of
  the bullet. What that menu can DO to a node is `menu_verbs.feature` and how
  its panel opens and shuts is `menu_panel.feature`; this is the gutter it
  hangs in, and the reading verbs it has always had.

  Background:
    Given I open the outline "house.olai"

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

  Scenario: The node menu's five read actions come first
    # What this row can WRITE is `menu_verbs.feature`'s subject; what belongs
    # here is that the reads are still at the top of the panel, in the order
    # they were, above the rule that separates them from everything that
    # changes the directory.
    When I open the node menu of "kitchen"
    Then the node menu offers "Zoom in"
    And the node menu offers "Collapse"
    And the node menu offers "Expand all"
    And the node menu offers "Collapse all"
    And the node menu offers "Copy link to node"

  Scenario: A copy the browser refused says so, instead of nothing
    # The clipboard is gated on a secure context, so a page served over plain
    # http to another machine on the LAN — how olai is normally read — refuses
    # every write. That refusal was caught and dropped, which made a copy that
    # never happened identical to one that worked.
    Given this browser's clipboard refuses
    When I open the node menu of "kitchen"
    And I choose "Copy link to node" from the node menu
    Then the node menu of "kitchen" says "couldn't copy link to node"

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
