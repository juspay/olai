@corpus:good
Feature: Zoom and navigate
  Every node is a page. Clicking a bullet zooms into it, its address is
  `/n/<id>`, and because ids are stable and unique across the whole served
  directory that address is a permalink: these scenarios load it cold, in a
  fresh tab, and expect the same page.

  What is DERIVED is the interesting half. The crumbs above a zoomed node are
  its canonical parent chain, worked out from the set rather than from how you
  got there — so zooming a mirror lands on the node itself, in the node's own
  file, under the node's own ancestors, and not on a second page for the
  placement that was clicked.

  Scenario: Clicking a bullet zooms into that node
    Given I open the outline "house.jsonl"
    And I mark the page
    When I zoom into the node "install"
    Then the zoomed node is "install"
    And the address is "/n/install"
    And the node "handles" is shown
    # A route, not a reload: the page answered in place.
    And the page has not reloaded
    And there should be no page errors

  Scenario: A permalink opens the same page cold
    When I open the node "handles"
    Then the zoomed node is "handles"
    And the breadcrumbs are "house.jsonl, kitchen remodel #home, install the cabinets"
    And the outline list is shown
    And there should be no page errors

  Scenario: A zoomed node shows its own note and children, not its siblings'
    When I open the node "kitchen"
    Then the zoomed node is "kitchen"
    And the node "install" is shown
    And the node "garden" is not shown

  Scenario: Breadcrumbs walk back up
    Given I open the node "handles"
    When I follow the breadcrumb "install the cabinets"
    Then the zoomed node is "install"
    And the address is "/n/install"

  Scenario: The trail roots at the node's own outline
    Given I open the node "handles"
    When I follow the breadcrumb "house.jsonl"
    Then the tree is shown
    And the address is "/o/house.jsonl"

  Scenario: Zooming a mirror lands on the node it stands for
    # `kitchen-herbs` lives in house.jsonl and mirrors `herbs` in garden.jsonl.
    # There is one page per node, so this is `herbs`' page — with `herbs`'
    # crumbs, in `herbs`' file, whichever placement was clicked.
    Given I open the outline "house.jsonl"
    When I zoom into the node "kitchen-herbs"
    Then the zoomed node is "herbs"
    And the breadcrumbs are "garden.jsonl, garden #outdoors"
    And the node "basil" is shown
    And there should be no page errors

  Scenario: Done nodes can be hidden, and come back
    Given I open the outline "house.jsonl"
    Then the node "demo" is shown
    When I hide the done nodes
    Then the node "demo" is not shown
    And the node "order" is shown
    When I show the done nodes
    Then the node "demo" is shown

  Scenario: A parent nobody marked stays on screen, with the notes under it
    # The bug this replaced, in one outline. `frames` carries no mark, and both
    # of its task children are done — so it used to DERIVE done, and the toggle
    # took the whole branch away, `slugs` included. Nobody had finished `slugs`;
    # nobody had even called it work. The view whose job is showing what is left
    # hid exactly what was left.
    #
    # Done-hidden now means what it says: the two DONE rows go, and the branch
    # nobody marked stays, with its note.
    Given I open the outline "garden.jsonl"
    Then the node "glazing" is shown
    When I hide the done nodes
    Then the node "glazing" is not shown
    And the node "sowing" is not shown
    And the node "frames" is shown
    And the node "slugs" is shown

  Scenario: A branch marked done is hidden with everything under it
    # The other half, and what makes the sweep honest: `herbs` carries `doing`,
    # so it stays — but a node whose own mark is `done` is somebody's claim
    # about the whole branch, and the toggle honours it.
    Given I open the outline "garden.jsonl"
    Then the node "herbs" is shown
    When I hide the done nodes
    Then the node "herbs" is shown
    And the node "basil" is not shown

  Scenario: Hiding done nodes works on a zoomed page too
    Given I open the node "herbs"
    Then the node "basil" is shown
    When I hide the done nodes
    Then the node "basil" is not shown
    And the node "mint" is shown

  Scenario: A zoomed page whose children are all done names Prefs
    # THE ONLY ON-SCREEN SENTENCE ABOUT THE SETTING, now the pill is gone.
    # `compost` has two done children and nothing unmarked, so hiding finished
    # work empties the page — and the copy says where the switch lives.
    Given I open the node "compost"
    Then the node "turned" is shown
    When I hide the done nodes
    Then the page says Prefs is hiding finished work

  Scenario: A page you go to starts at the top, and the one you come back to does not
    # Two halves of one decision, and neither happens by itself: a route change
    # redraws the main pane and moves nothing else, so zooming from the bottom
    # of a long outline used to land the new page mid-scroll at a line nobody
    # chose, and coming back landed wherever the redraw happened to leave
    # things. The window is made short because the page has to be taller than
    # what is showing for any of this to mean anything.
    Given the window is shorter than the page
    And I open the outline "house.jsonl"
    And I mark the page
    And I scroll to the bottom of the page
    When I zoom into the node "install"
    Then the page is at the top
    When I go back
    Then the tree is shown
    And the page is back where I left it
    # One document throughout: where the reader was is remembered per history
    # entry, in this page's own memory, and a reload would have emptied it.
    And the page has not reloaded
    And there should be no page errors

  Scenario: An id nothing declares is a clean not-found
    When I open the node "no-such-node"
    Then a not-found is shown
    And no outline tree is shown
    # Not a dead end: the sidebar is still the way home.
    And the outline list is shown
    And there should be no page errors

  Scenario: A see reference is a link to the target's page
    # `order` carries `see: ["herbs"]` — a free cross-reference into the other
    # outline. See links ride the expanded note (click), the link text is the
    # TARGET's title, and clicking it is the same navigation a bullet is:
    # `/n/<id>`, no reload.
    Given I open the outline "house.jsonl"
    When I click the note of "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    Given I mark the page
    When I follow the see link to "herbs" on "order"
    Then the zoomed node is "herbs"
    And the address is "/n/herbs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A see reference on a zoomed page navigates too
    # Same link, drawn under the subject rather than a tree row — NodeBody is
    # one place, and both surfaces have to keep working when either changes.
    Given I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I follow the see link to "herbs" on "order"
    Then the zoomed node is "herbs"
    And the address is "/n/herbs"
    And there should be no page errors

  Scenario: The waiting mark opens the page that names the blockers
    # A row has room for a glyph, not for names, so the click is spent going
    # to the node's OWN page — where they are all named. The box is
    # display-only until keyboard-editing, so the click promises nothing else.
    Given I open the outline "house.jsonl"
    And I mark the page
    When I follow the waiting mark on "hinges"
    Then the zoomed node is "hinges"
    And the address is "/n/hinges"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed page names every blocker, and each one is a link
    # The page is where the node is READ, so "waiting on what?" is answered
    # rather than hinted at — the blocker by title, at its own address.
    Given I open the node "hinges"
    Then the node "hinges" is blocked by "order"
    When I follow the blocked link to "order" on "hinges"
    Then the zoomed node is "order"
    And the address is "/n/order"
    And there should be no page errors

  Scenario: The waiting mark's tip stays inside the window, and there is one of it
    # Its own tip rather than the platform's `title`, because a long one ran
    # off the right edge with the end of the sentence outside the screen. What
    # it says is the label's sentence; where it goes is arithmetic (tip.ts).
    #
    # "A tip says" counts as well as reads: a doubled tip said the right thing
    # twice, a few pixels apart and unreadable, and every assertion about the
    # TEXT passed while the screen was wrong.
    Given I open the outline "house.jsonl"
    When I hover the waiting mark on "hinges"
    Then a tip says "blocked by order the new cabinets"
    And the tip is inside the window
    # And READABLE: a blocked row is dimmed, and a tip drawn inside one wore
    # that dim — the note underneath showed through its own words.
    And the tip is fully opaque
    # And it goes when the pointer does — a tip that outlives its pointer is
    # the ghost that made two of them in the first place.
    When I move the pointer away
    Then no tip is shown
    And there should be no page errors
