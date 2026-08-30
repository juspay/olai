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
    And the address is "/#install"
    And the node "handles" is shown
    # A route, not a reload: the page answered in place.
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
    Then the zoomed node is "install"
    And the address is "/#install"

  Scenario: The trail roots at the node's own outline
    Given I open the node "handles"
    When I follow the breadcrumb "house.olai"
    Then the tree is shown
    And the address is "/house.olai"

  Scenario: Zooming a mirror lands on the node it stands for
    # `kitchen-herbs` lives in house.olai and mirrors `herbs` in garden.olai.
    # There is one page per node, so this is `herbs`' page — with `herbs`'
    # crumbs, in `herbs`' file, whichever placement was clicked.
    Given I open the outline "house.olai"
    When I zoom into the node "kitchen-herbs"
    Then the zoomed node is "herbs"
    And the breadcrumbs are "garden.olai, garden #outdoors"
    # `mint` rather than `basil` for the identity row: the finished child is
    # hidden until this page is asked for it, which no press of a placard
    # does, and what this scenario claims is WHICH page the press landed on.
    And the node "mint" is shown
    And there should be no page errors

  Scenario: Done nodes can be hidden, and come back
    # Hidden is where every page starts now (the per-page pick's default), so
    # this walks the pick both ways from there.
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
    # The bug this replaced, in one outline. `frames` carries no mark, and both
    # of its task children are done — so it used to DERIVE done, and the toggle
    # took the whole branch away, `slugs` included. Nobody had finished `slugs`;
    # nobody had even called it work. The view whose job is showing what is left
    # hid exactly what was left.
    #
    # Done-hidden now means what it says: the two DONE rows go, and the branch
    # nobody marked stays, with its note. (Hidden IS the default now, so the
    # walk there is the page's own starting state and this hides it by asking.)
    Given I open the outline "garden.olai"
    When I hide the done nodes
    Then the node "glazing" is not shown
    And the node "sowing" is not shown
    And the node "frames" is shown
    And the node "slugs" is shown

  Scenario: A branch marked done is hidden with everything under it
    # The other half, and what makes the sweep honest: `herbs` carries `doing`,
    # so it stays — but a node whose own mark is `done` is somebody's claim
    # about the whole branch, and the toggle honours it.
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
    # THE ONLY ON-SCREEN SENTENCE ABOUT THE SETTING: `compost` has two done
    # children and nothing unmarked, so the pick this page answers to empties
    # it — and the copy names the door: the flip beside the page's own
    # filter. It IS there from the first frame now, and the walk out and
    # back proves the pick both ways.
    Given I open the node "compost"
    Then the page names that finished work is hidden
    When I show the done nodes
    Then the node "turned" is shown
    When I hide the done nodes
    Then the page names that finished work is hidden

  Scenario: A page you go to starts at the top, and the one you come back to does not
    # Two halves of one decision, and neither happens by itself: a route change
    # redraws the main pane and moves nothing else, so zooming from the bottom
    # of a long outline used to land the new page mid-scroll at a line nobody
    # chose, and coming back landed wherever the redraw happened to leave
    # things. The window is made short because the page has to be taller than
    # what is showing for any of this to mean anything.
    #
    # "keeping the bullet pressable" is the other half of being honest about
    # where the reader was: at the very bottom of this page the pinned
    # `kitchen` heading lies exactly over `install`'s bullet, so a press
    # aimed there is one no reader could make — and Playwright answers a press
    # like that by scrolling the page until it lands, which on a slow box left
    # the reader at 0 before the navigation ever happened. The client then
    # remembered 0 and put them back at 0, correctly, and this scenario failed
    # for a position nobody was ever at.
    Given the window is shorter than the page
    And I open the outline "house.olai"
    And I mark the page
    And I scroll to the bottom of the page, keeping the bullet of "install" pressable
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
    # `/#<id>`, no reload.
    Given I open the outline "house.olai"
    When I open the note of "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    Given I mark the page
    When I follow the see link to "herbs" on "order"
    Then the zoomed node is "herbs"
    And the address is "/#herbs"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A see reference on a zoomed page navigates too
    # Same link, drawn under the subject rather than a tree row — NodeBody is
    # one place, and both surfaces have to keep working when either changes.
    Given I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I follow the see link to "herbs" on "order"
    Then the zoomed node is "herbs"
    And the address is "/#herbs"
    And there should be no page errors

  Scenario: The waiting mark opens the page that names the blockers
    # A row has room for a glyph, not for names, so the click is spent going
    # to the node's OWN page — where they are all named. The box is
    # display-only until keyboard-editing, so the click promises nothing else.
    Given I open the outline "house.olai"
    And I mark the page
    When I follow the waiting mark on "hinges"
    Then the zoomed node is "hinges"
    And the address is "/#hinges"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A zoomed page names every blocker, and each one is a link
    # The page is where the node is READ, so "waiting on what?" is answered
    # rather than hinted at — the blocker by title, at its own address.
    Given I open the node "hinges"
    Then the node "hinges" is blocked by "order"
    When I follow the blocked link to "order" on "hinges"
    Then the zoomed node is "order"
    And the address is "/#order"
    And there should be no page errors

  Scenario: A row address opens the outline landed on the row, cold
    # The qualified spelling — `/file#id`, the address a link to a row carries
    # — in a fresh document, the way it arrives from a chat message or a pin.
    # This pins the RECORD-id half: the mirror scenarios beside it must leave
    # it byte-identical.
    When I open the address "/house.olai#install"
    Then the tree is shown
    And the node "install" is focused
    And the address is "/house.olai#install"
    And there should be no page errors

  Scenario: A row address naming a placement lands on the mirror's own row
    # `kitchen-herbs` is a MIRROR: `read_node`'s `mirrors` reports the
    # placement's own id, and an agent citing the row spells exactly that —
    # the fragment then names no node the page shows, only a place it draws.
    # The landing answers the id with the mirror row itself, which is the
    # more specific of the two answers the page holds for it: the accent
    # lands where the id says.
    When I open the address "/house.olai#kitchen-herbs"
    Then the node "kitchen-herbs" is focused
    And the address is "/house.olai#kitchen-herbs"
    And there should be no page errors

  Scenario: A row address naming a done-hidden row lands on it — revealed, and the pick untouched
    # `basil` is done, and every page starts hidden — so this address used
    # to open the outline and answer with the miss line: the row was THERE,
    # and the landing already pays a collapsed ancestor the courtesy of
    # unfolding it; the pick's hide is no more of a wall than a fold is.
    # The row is REVEALED — for the visit, with the pick's word left exactly
    # as the reader left it (client/settings/done.ts's third projection).
    When I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    # And nothing the address did not name came back with it: the page's
    # OTHER finished rows stay hidden, the flip still answers "Hidden",
    # and no word was minted for this page — the reveal is the landing's,
    # never the page's.
    And the node "glazing" is not shown
    And the node "turned" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "garden.olai"
    And there should be no page errors

  Scenario: The reveal belongs to the landing — it goes with the page, and the pick reasserts on return
    # The row is drawn back FOR THE VISIT: nothing is stored, so leaving the
    # page is the end of the courtesy — a fresh visit hides the row again,
    # which is exactly what the pick says about it.
    When I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I click the outline "house.olai"
    And I click the outline "garden.olai"
    Then the node "basil" is not shown
    And the node "mint" is shown
    And there should be no page errors

    @scratch:good
  Scenario: An address into a branch both collapsed and done-hidden pays BOTH courtesies — ancestor, too
    # The two edges the landing rides are INDEPENDENT — the fold half's
    # unfold, the pick half's reveal — and one address's chain can need
    # each's FULL shape at once: `herbs` is here DONE ITSELF — completed
    # for the walk — so the pick sweeps it like any done row AND its place
    # is one the chain must ask kept: the both-courtesies pin would stop
    # reading honestly if the ancestor merely stayed doing, because folding
    # a STILL-DRAWN ancestor never asks the sweep anything. Order matters:
    # the fold is REMEMBERED first — a folded row stays a fold answer once
    # hidden — and the Complete is the row's own mark.
    Given I open the outline "garden.olai"
    When I collapse the node "herbs"
    And I open the node menu of "herbs"
    And I choose "Complete" from the node menu
    And I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    And the node "herbs" is expanded
    # ...and the kept ancestor's OTHER children answer by their OWN marks —
    # the sweep's walk is by place, all the way down (the derive pin): the
    # `doing` sibling is there with them.
    And the node "mint" is shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And there should be no page errors

  Scenario: Under a typed question the act writes nothing — a narrowed row address is missed, not revealed
    # The reveal is re-asked ONLY where the pick's sweep is why a row is
    # gone. A filter is a property of the address (`?q=` rides the route),
    # so the landed-on address can arrive narrowed — and under the reader's
    # own typed question the row is gone because of THAT, which the pick
    # never touched and the reveal is owed nothing about
    # (`fold/reading.ts`: a landing's arrivals draw the narrow reading;
    # the reveal's answer is not asked at all). So this landing answers the
    # reading the address says: the miss sentence, the row undrawn, NOTHING
    # written behind the reader's back — and clearing the box finds the
    # pick's sweep exactly as it stood, word and strip alike.
    When I open the address "/garden.olai?q=slugs#basil"
    Then the filter found "1 of 11"
    And the landing says "basil — what it names is not drawn on this page"
    And the node "basil" is not shown
    When I clear the filter
    Then the node "basil" is not shown
    And the node "glazing" is not shown
    And this page's Done flip says "hidden"
    And the Done flip is the panel's answer
    And this browser has stored no Done word on "garden.olai"
    And there should be no page errors

  Scenario: The reveal dies with its gates — a query typed over it, or the pick's own round trip
    # The arrive-narrowed walk is half the fence; stand on the LANDED page
    # for the other: the reveal was minted under "this page is swept, and
    # nothing typed" — the moment EITHER half stops holding, the row answers
    # its own words again, without the page ever going anywhere.
    When I open the address "/garden.olai#basil"
    Then the node "basil" is focused
    And the node "basil" is shown
    # ...a query typed over the arrival: the reading runs the filter's way
    # and the row answers ITS words with the reveal dead — clearing the box
    # cannot bring the row back, the courtesy's moment was the arrival's.
    When I filter the page by "slugs"
    Then the filter found "1 of 11"
    And the node "basil" is not shown
    When I clear the filter
    Then the node "basil" is not shown
    # ...and the reader's own two-word round trip: WITHOUT a fresh arrival
    # here the flip half would pin nothing — the reveal is dead from the
    # query already — so this lands once more, standing the courtesy back
    # up before the flip, and what EVERY step below says now hangs from the
    # landing's gates, never from the trip already past.
    When I open the address "/garden.olai#basil"
    Then the node "basil" is shown
    When I show the done nodes
    Then the node "basil" is shown
    When I hide the done nodes
    Then the node "basil" is not shown
    And there should be no page errors

  Scenario: A row address into a collapsed branch opens it, exactly as ever
    # The OLDER courtesy, pinned beside the new one: the reveal changed
    # where the landing asks its rows, and this walk proves the fold half
    # stood fast — a branch the reader shut unfolds for the address, the
    # landing finds the row and focuses it. The detour through garden.olai
    # is the reload-and-return: folds are remembered across it.
    Given I open the outline "house.olai"
    When I collapse the node "install"
    And I open the outline "garden.olai"
    And I open the address "/house.olai#hinges"
    Then the node "hinges" is focused
    And the node "install" is expanded
    And there should be no page errors

  Scenario: A row address naming nothing on the page says so
    # NOTHING FOUND IS NOTHING DONE — but it is SAID, which used not to be
    # so: a dead link answered the same silence a working one did, and the
    # only reader who could tell them apart was the one who wrote the link.
    # The page opens whole, and the one alarm line answers what was asked
    # and that the page draws none of it.
    When I open the address "/house.olai#no-such-row"
    Then the tree is shown
    And the landing says "no-such-row — nothing by that name is drawn on this page"
    # ...and it is a notice, not a state: the way every transient line in
    # this client goes.
    And the landing's sentence has gone
    And there should be no page errors

  Scenario: A row address naming a node this file does not draw says WHICH half of dead it isn't
    # `glazing` is a real node — in `garden.olai`, nobody here: the set DOES
    # declare the id, and this page draws no row of it — the other degree of
    # certain miss (`fold/landing.ts`'s `missedSays`): not "nothing by that
    # name" — that would make a working link indistinguishable from a dead
    # one, the symmetric half of the silence the miss sentence closed (the
    # review ruling, and the same could be said of a DONE row whose reader
    # hides done). Then said then gone, the way any transient line goes.
    When I open the address "/house.olai#glazing"
    Then the tree is shown
    And the landing says "glazing — what it names is not drawn on this page"
    And the landing's sentence has gone
    And there should be no page errors

  Scenario: The sentence belongs to its page -- an in-page navigation takes it down
    # The notice and its page used to be keyable apart: the line minted for
    # one file could ride its six seconds over the next page's tree, the
    # wrong-attribution half of the same ruling. The door OUT of the page
    # matters just as much as the bound: a fresh GOTO would throw the line
    # overboard with the whole document and ask nothing of the boundary, so
    # it goes the SPA way — a directory click, the drawer's own link — the
    # component stays, and only the stretch's own ending may answer.
    When I open the address "/house.olai#no-such-row"
    Then the tree is shown
    And the landing says "no-such-row — nothing by that name is drawn on this page"
    When I click the outline "garden.olai"
    # BOUNDED under the line's own six seconds, or the dead-miss step above
    # would ask this no question at all: BY the boundary is the claim here,
    # not BY the clock as it was up there (the review's own fence-ruling).
    Then the landing's sentence has gone with its page
    And there should be no page errors
