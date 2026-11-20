@share-scratch
@scratch:good
Feature: Dragging a row from one pane into the other
  A drag was a fact about one page for as long as there was one page. With
  split panes (#225) it is a fact about the WORKSPACE: pick a row up by its
  bullet in one pane, carry it over the pane beside it, and the same drop line
  that has always said where it would land says so there — the same gap, the
  same depth, the same `place` the ops layer already had.

  TWO PANES, TWO ANSWERS. Showing the SAME file they reorganize each other:
  the write goes to the file, both trees redraw off the one store, and the row
  leaves one pane and arrives in the other on the same frame. Showing
  DIFFERENT files they cannot — a parent is always in the same file, which is
  the format's own rule and the one `outlines_move` refuses on — so the pane says
  so under the pointer, before the hand lets go, rather than swallowing a drop
  or landing it somewhere nobody was pointing.

  `@scratch:` for the reason the in-pane drag's scenarios are: these write the
  directory they are served. They share one copy per worker (`@share-scratch`);
  the corpus is restored between scenarios.

  Scenario: A row picked up in one pane lands in the other, and both see it
    When I open the address "/s/house.olai/house.olai"
    And I show the done nodes
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 1
    Then the drop line would put it under "kitchen"
    And the drop line would put it first
    When I let go
    Then the node "knobs" is a child of "kitchen" in pane 1
    And the node "knobs" is a child of "kitchen" in pane 0
    And the node "knobs" is not a child of "install" in pane 0
    And "house.olai" holds the node "knobs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The line promising the landing is drawn over the pane it names
    When I open the address "/s/house.olai/house.olai"
    And I show the done nodes
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 1
    Then the drop line is drawn over pane 1
    When I let go
    Then there should be no page errors

  Scenario: A drag that stays in its own pane still lands in its own pane
    When I open the address "/s/house.olai/house.olai"
    And I show the done nodes
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 0
    Then the drop line is drawn over pane 0
    And the drop line would put it under "kitchen"
    When I let go
    Then the node "knobs" is a child of "kitchen" in pane 0
    And there should be no page errors

  Scenario: A row held over another file's pane is refused there, in words, before the drop
    When I open the address "/s/house.olai/garden.olai"
    And I mark the page
    And I pick up the bullet of "knobs" in pane 0 and hold it over the title of "mint" in pane 1
    Then the drop is refused by "garden.olai"
    And the refused pane says "only moves a row within its own outline"
    And no drop line is drawn
    When I let go
    Then the pick says "only moves a row within its own outline"
    And the node "knobs" is a child of "install" in pane 0
    And "house.olai" holds the node "knobs"
    And there should be no page errors

  Scenario: The pane the drag began in is unaffected by the one that refuses
    When I open the address "/s/house.olai/garden.olai"
    And I mark the page
    Then pane 0 is focused
    And I show the done nodes
    And I pick up the bullet of "knobs" in pane 0 and hold it above the title of "demo" in pane 0
    Then no drop is refused
    And the drop line would put it under "kitchen"
    When I let go
    Then the node "knobs" is a child of "kitchen" in pane 0
    And there should be no page errors

  Scenario: A pane zoomed into the branch being carried has nowhere to put it
    When I open the address "/s/house.olai/zoom%2F%23install"
    And I mark the page
    And I pick up the bullet of "install" in pane 0 and hold it over the title of "handles" in pane 1
    Then the drop is refused by "house.olai"
    And the refused pane says "every row in this pane is part of what you’re dragging"
    And the refused pane does not say "only moves a row within its own outline"
    And no drop line is drawn
    When I let go
    Then the pick says "every row in this pane is part of what you’re dragging"
    And the node "install" is a child of "kitchen" in pane 0
    And there should be no page errors
