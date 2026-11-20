@corpus:good
Feature: Workflowy gutter
  The outline gutter matches Workflowy: ONE glyph cell, a gray halo when
  children are hidden, a hover-reveal `•••` menu and collapse triangle left of
  it. What that menu can DO to a node is `menu_verbs.feature` and how its panel
  opens and shuts is `menu_panel.feature`; this is the gutter it hangs in, and
  the reading verbs it has always had.

  ONE CELL, not two (the quiet outline). The bullet and the status box used to
  be separate columns, so every row in every tree spent two fixed widths before
  its title to say one thing. They are merged: the glyph IS the mark when the
  node carries one, the bullet when it does not, the hourglass when it cannot
  start yet — and it is the link into the node in all three cases. What each
  face means is `see_the_outline.feature`'s; that it is one control is this
  feature's.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes

  Scenario: The mark and the way into the node are one cell
    Then the node "order" shows a doing checkbox
    And the node "handles" shows no checkbox
    When I click the bullet of "order"
    Then the zoomed node is "order"

  Scenario: A collapsed parent shows the halo on its bullet
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    Then the node "kitchen" is collapsed
    And the node "kitchen" shows a collapsed halo
    And the children of "kitchen" are hidden
    And the node "kitchen" says it is folding "2" finished rows

  Scenario: A fold over nothing finished says nothing
    Given the node "install" is expanded
    When I collapse the node "install"
    Then the node "install" is collapsed
    And the node "install" says nothing about folded finished rows

  Scenario: Expanding clears the halo
    Given the node "kitchen" is expanded
    When I collapse the node "kitchen"
    And I expand the node "kitchen"
    Then the node "kitchen" shows no collapsed halo

  Scenario: On a pointer device the menu and triangle are hidden until hover
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

  Scenario: The node menu is short, in groups, with Move to Trash last and alone
    When I open the node menu of "kitchen"
    Then the node menu reads, in order:
      | Zoom in        |
      | Mark ›         |
      | —              |
      | Set date…      |
      | Pin to sidebar |
      | —              |
      | Move to…       |
      | Duplicate      |
      | —              |
      | Start an agent |
      | —              |
      | More ›         |
      | —              |
      | Move to Trash  |
    And the node menu does not offer "Collapse"
    And the node menu offers "More › Expand all"
    And the node menu offers "More › Collapse all"
    And the node menu offers "More › Copy link"

  Scenario: Zoom in from the menu stays in the same document
    Given I mark the page
    When I open the node menu of "kitchen"
    And I choose "Zoom in" from the node menu
    Then the zoomed node is "kitchen"
    And the page has not reloaded

  Scenario: Collapse all from the menu hides children
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen"
    And I choose "More › Collapse all" from the node menu
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node "kitchen" shows a collapsed halo

  Scenario: Expand all from the menu opens a nested fold
    Given the node "kitchen" is expanded
    And the node "install" is expanded
    When I collapse the node "install"
    And I open the node menu of "kitchen"
    And I choose "More › Expand all" from the node menu
    Then the node "kitchen" is expanded
    And the node "install" is expanded
    And the children of "install" are shown

  Scenario: Where the rollup already counts it, the fold says nothing
    Given I open the outline "garden.olai"
    And I show the done nodes
    And the node "compost" is expanded
    When I collapse the node "compost"
    Then the node "compost" is collapsed
    And the node "compost" shows the progress "2/2"
    And the node "compost" says nothing about folded finished rows

  Scenario: Where the rollup cannot see it, the fold still says so
    Given I open the outline "garden.olai"
    And I show the done nodes
    And the node "garden" is expanded
    When I collapse the node "garden"
    Then the node "garden" is collapsed
    And the node "garden" shows the progress "0/1"
    And the node "garden" says it is folding "5" finished rows
