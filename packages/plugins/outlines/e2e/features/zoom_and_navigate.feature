@corpus:good
Feature: Zoom and navigate
  Every node is a page. Clicking a bullet zooms into it, its address is
  `/#<id>`, and because ids are stable and unique across the whole served
  directory that address is a permalink: these scenarios load it cold, in a
  fresh tab, and expect the same page.

  What is DERIVED is the interesting half. The crumbs above a zoomed node are
  its canonical parent chain, worked out from the set rather than from how you
  got there — so zooming a mirror lands on the node itself, in the node's own
  file, under the node's own ancestors, and not on a second page for the
  placement that was clicked.

  Scenario: Clicking a bullet zooms into that node
    Given I open the outline "house.olai"
    And I mark the page
    When I zoom into the node "install"
    Then the zoomed node is "install"
    And the address is "/zoom/#install"
    And the node "handles" is shown
    And the page has not reloaded
    And there should be no page errors

  Scenario: A permalink opens the same page cold
    When I open the node "handles"
    Then the zoomed node is "handles"
    And the breadcrumbs are "house.olai, kitchen remodel #home, install the cabinets"
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
    Then the unified destination row "install" is selected
    And the address is "/house.olai#install"

  Scenario: The trail roots at the node's own outline
    Given I open the node "handles"
    When I follow the breadcrumb "house.olai"
    Then the tree is shown
    And the address is "/house.olai"

  Scenario: Zooming a mirror lands on the node it stands for
    Given I open the outline "house.olai"
    When I zoom into the node "kitchen-herbs"
    Then the zoomed node is "herbs"
    And the breadcrumbs are "garden.olai, garden #outdoors"
    And the node "mint" is shown
    And there should be no page errors

  Scenario: Done nodes can be hidden, and come back
    Given I open the outline "house.olai"
    Then the node "demo" is not shown
    When I show the done nodes
    Then the node "demo" is shown
    When I hide the done nodes
    Then the node "demo" is not shown
    And the node "order" is shown
    When I show the done nodes
    Then the node "demo" is shown

  Scenario: A parent nobody marked stays on screen, with the notes under it
    Given I open the outline "garden.olai"
    When I hide the done nodes
    Then the node "glazing" is not shown
    And the node "sowing" is not shown
    And the node "frames" is shown
    And the node "slugs" is shown

  Scenario: A branch marked done is hidden with everything under it
    Given I open the outline "garden.olai"
    When I show the done nodes
    Then the node "basil" is shown
    When I hide the done nodes
    Then the node "herbs" is shown
    And the node "basil" is not shown

  Scenario: Hiding done nodes works on a zoomed page too
    Given I open the node "herbs"
    Then the node "basil" is not shown
    When I show the done nodes
    Then the node "basil" is shown
    When I hide the done nodes
    Then the node "basil" is not shown
    And the node "mint" is shown

  Scenario: A zoomed page whose children are all done names the flip
    Given I open the node "compost"
    Then the empty zoomed page says "Everything here is finished, and finished items are hidden."
    When I show the done nodes
    Then the node "turned" is shown
    When I hide the done nodes
    Then the empty zoomed page says "Everything here is finished, and finished items are hidden."

  Scenario: A page you go to starts at the top, and the one you come back to does not
    Given the window is shorter than the page
    And I open the outline "house.olai"
    And I mark the page
    And I scroll to the bottom of the page, keeping the bullet of "install" pressable
    When I zoom into the node "install"
    Then the page is at the top
    When I go back
    Then the tree is shown
    And the page is back where I left it
    And the page has not reloaded
    And there should be no page errors

  Scenario: An id nothing declares is a clean not-found
    When I open the node "no-such-node"
    Then a not-found is shown
    And no outline tree is shown
    And the outline list is shown
    And there should be no page errors

  Scenario: A see reference is a link to the target's page
    Given I open the outline "house.olai"
    When I open the note of "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    Given I mark the page
    When I follow the see link to "herbs" on "order"
    Then the unified destination row "kitchen-herbs" is selected
    And the address is "/house.olai"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A see reference on a zoomed page navigates too
    Given I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I follow the see link to "herbs" on "order"
    Then the unified destination row "herbs" is selected
    And the address is "/garden.olai#herbs"
    And there should be no page errors

  Scenario: The waiting mark opens the page that names the blockers
    Given I open the outline "house.olai"
    And I mark the page
    When I follow the waiting mark on "hinges"
    Then the zoomed node is "hinges"
    And the address is "/zoom/#hinges"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed page names every blocker, and each one is a link
    Given I open the node "hinges"
    Then the node "hinges" is blocked by "order"
    When I follow the blocked link to "order" on "hinges"
    Then the unified destination row "order" is selected
    And the address is "/house.olai#order"
    And there should be no page errors

  Scenario: A row address opens the outline landed on the row, cold
    When I open the address "/house.olai#install"
    Then the tree is shown
    And the node "install" is focused
    And the address is "/house.olai#install"
    And there should be no page errors

  Scenario: A row address naming a placement lands on the mirror's own row
    When I open the address "/house.olai#kitchen-herbs"
    Then the node "kitchen-herbs" is focused
    And the address is "/house.olai#kitchen-herbs"
    And there should be no page errors

  Scenario: A row address naming a done-hidden row lands on it — revealed, and the pick untouched
    When I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    And the node "glazing" is not shown
    And the node "turned" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "garden.olai"
    And there should be no page errors

  Scenario: The reveal belongs to the landing — it goes with the page, and the pick reasserts on return
    When I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I click the outline "house.olai"
    And I click the outline "garden.olai"
    Then the node "basil" is not shown
    And the node "mint" is shown
    And there should be no page errors

    @scratch:good
  Scenario: An address into a branch both collapsed and done-hidden pays BOTH courtesies — ancestor, too
    # Order matters:
    # the fold is REMEMBERED first — a folded row stays a fold answer once
    # hidden — and the Complete is the row's own mark.
    Given I open the outline "garden.olai"
    When I collapse the node "herbs"
    And I open the node menu of "herbs"
    And I choose "Mark › Done" from the node menu
    And I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    And the node "herbs" is expanded
    And the node "mint" is shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And there should be no page errors

  Scenario: Under a typed question the act writes nothing — a narrowed row address is missed, not revealed
    When I open the address "/garden.olai?q=slugs#basil"
    Then the filter found "1 of 11"
    And the landing says "basil — not shown on this page"
    And the node "basil" is not shown
    When I clear the filter
    Then the node "basil" is not shown
    And the node "glazing" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "garden.olai"
    And there should be no page errors

  Scenario: The reveal dies with its gates — a query typed over it, or the pick's own round trip
    When I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    When I filter the page by "slugs"
    Then the filter found "1 of 11"
    And the node "basil" is not shown
    When I clear the filter
    Then the node "basil" is not shown
    When I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I show the done nodes
    Then the node "basil" is shown
    When I hide the done nodes
    Then the node "basil" is not shown
    And there should be no page errors

  Scenario: A row address into a collapsed branch opens it, exactly as ever
    Given I open the outline "house.olai"
    When I collapse the node "install"
    And I open the outline "garden.olai"
    And I open the address "/house.olai#hinges"
    Then the node "hinges" is focused
    And the node "install" is expanded
    And there should be no page errors

  Scenario: A row address naming nothing on the page says so
    When I open the address "/house.olai#no-such-row"
    Then the tree is shown
    And the landing says "no-such-row — not found"
    And the landing's sentence has gone
    And there should be no page errors

  Scenario: A row address naming a node this file does not draw says WHICH half of dead it isn't
    When I open the address "/house.olai#glazing"
    Then the tree is shown
    And the landing says "glazing — not shown on this page"
    And the landing's sentence has gone
    And there should be no page errors

  Scenario: The sentence belongs to its page -- an in-page navigation takes it down
    When I open the address "/house.olai#no-such-row"
    Then the tree is shown
    And the landing says "no-such-row — not found"
    When I click the outline "garden.olai"
    Then the landing's sentence has gone with its page
    And there should be no page errors

  Scenario: Walking to a mirrored outline waits for that outline's page, not for a row it lends
    Given I open the outline "house.olai"
    Then the node "mint" is shown
    And the focused pane is drawing the outline "house.olai"
    When I click the outline "garden.olai"
    Then the focused pane is drawing the outline "garden.olai"
    And the node "herbs" is shown
    When I click the outline "house.olai"
    Then the focused pane is drawing the outline "house.olai"
    And the node "kitchen" is shown
    And there should be no page errors
