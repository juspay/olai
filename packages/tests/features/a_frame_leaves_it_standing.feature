@scratch:good
Feature: A frame leaves the rest of the page standing
  `the_chrome_holds_still.feature` asks this of a NAVIGATION. This is the same
  question asked of a FRAME: what somebody else's write, arriving under a page
  already on screen, was allowed to touch.

  The store publishes a whole frame whenever anything on the open page changes,
  and — because a frame is merged without an array key — every element of every
  array in it is a FRESH OBJECT (docs/brainstorming/reactivity-after-the-flip.md
  §2). A list drawn by reference therefore rebuilt itself on every frame,
  whether or not one word of it had changed: the crumbs over a zoomed node, the
  properties under an open row, the chips in an open edge panel, the rows in a
  document's referrers section, every pin on the shelf.

  Nothing on screen said so — a rebuilt list is drawn with the same tags, the
  same attributes and the same words as a patched one. What it costs is what the
  elements were HOLDING: the caret somebody had tabbed onto an `×`, the row under
  a pointer, a scroll position. So these scenarios ask the elements themselves —
  serial every one before, count the survivors after
  (`step_definitions/redraw_steps.ts`, and §6 of the audit, where the numbers
  come from).

  Each scenario makes ONE thing happen that publishes a frame and then asserts
  about what that frame did not touch. `@scratch:` because they write the
  directory they are served — and they write the same files as each other, so
  there is nothing here for `@share-scratch` to share.

  Background:
    Given I open the app

  Scenario: The crumbs over a zoomed node hold still while a row under it is retitled
    Given I open the node "install"
    And I mark the page
    Then the node "handles" is shown
    And I mark every element of the "breadcrumbs"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets"}
      {"id":"handles","parent":"install","ord":"a0","title":"choose the handles today"}
      {"id":"hinges","parent":"install","ord":"a1","title":"pick the hinges"}
      """
    Then the node "handles" has the title "choose the handles today"
    And the "breadcrumbs" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: An open row's properties hold still while another row is retitled
    # The ROW is where a node is an array element, which is where the rebuild
    # was: a zoomed heading's node is merged in place and never showed it.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles"}
      {"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the hinges","custom":{"pr":"https://example.invalid/1","stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I open the note of "hinges"
    Then the node "hinges" shows the property "pr" holding "https://example.invalid/1"
    And I mark every element of the "property drawer"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles today"}
      {"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the hinges","custom":{"pr":"https://example.invalid/1","stage":"review"}}
      """
    Then the node "handles" has the title "choose the handles today"
    And the "property drawer" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: The caret stays on an edge panel's × while somebody else writes
    # The one whose cost is visible without a probe: the chips were rebuilt on
    # every frame, so a reader who had tabbed onto an `×` to take a link off
    # lost the caret to the document body the moment anybody wrote anything.
    Given I open the outline "house.olai"
    And I mark the page
    When I open the node menu of "order"
    And I choose "Link to a node…" from the node menu
    Then the edge panel holds "herbs"
    When I put the caret on the edge panel's ×
    And I mark every element of the "edge panel's list"
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","see":["herbs"]}
      {"id":"handles","parent":"kitchen","ord":"a2","title":"choose the handles today"}
      """
    Then the node "handles" has the title "choose the handles today"
    And the "edge panel's list" kept every element it had
    And the caret is still on the edge panel's ×
    # ...and not because the caret survived a reload, which would have taken the
    # panel with it.
    And the page has not reloaded
    And there should be no page errors

  Scenario: A document's referrers hold still while a second one is written
    Given I open the document "finishes.md"
    And I mark the page
    When I open what points at the document
    # The ROWS, not the count on the shut summary: the section is minted when
    # the reading arrives, so a section marked before it was drawn would be a
    # scenario watching a `<details>` with nothing under it.
    Then what points at the document is "install the cabinets"
    And I mark every element of the "referrers section"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets","doc":"finishes.md"}
      {"id":"handles","parent":"kitchen","ord":"a1","title":"choose the handles","doc":"finishes.md"}
      """
    Then the document is pointed at by 2 things
    And what points at the document is "install the cabinets, choose the handles"
    And the "referrers section" kept every element it had
    And the page has not reloaded
    And there should be no page errors

  Scenario: The shelf holds still while a pinned node is retitled somewhere else
    # A pins frame goes out for a pin added, a pin reordered, or — as here — a
    # pinned node retitled in the file it lives in. Every `<Pin>` was rebuilt for
    # it: a column of links flickering in the corner of the eye of somebody
    # typing on a different page entirely.
    Given I open the node "herbs"
    And I pin the page
    When I open the outline "house.olai"
    And I mark the page
    And I pin the page
    Then the pinned shelf holds "/#herbs"
    And the pinned shelf holds "/house.olai"
    And I mark every element of the "pinned shelf"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the gate"}
      """
    Then the pin "/#herbs" is named "the herb bed by the gate"
    And the "pinned shelf" kept every element it had
    And the page has not reloaded
    And there should be no page errors
