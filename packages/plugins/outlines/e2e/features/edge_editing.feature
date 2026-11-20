@share-scratch
@scratch:good
Feature: Writing a node's edges — `see` and `after`
  The web has DRAWN both edges since edges-ui: the `see` links under a node,
  and — for `after` — the dim on a row, the mark column's glyph and the
  `blocked by` line on a node's page. It could write neither. An agent could do
  both (`outlines_see`, `outlines_after`), so that was a standing consistency violation
  rather than a missing feature ("MCP and Web ops must be
  consistent; never deviate").

  Two doors onto one op, and the same op either way: the `•••` menu's two
  verbs on a row, and — on a zoomed node, whose heading has no `•••` — two
  controls beside the rows they are about. Each opens a panel holding what the
  node says NOW, with an `×` on each, and the server's own node search for what
  to add. Nothing is echoed: a reference appears when the file says it does.

  And the refusals are the ops layer's own, verbatim. An `after` that would
  close a loop is refused NAMING the loop — the sentence an agent gets, on the
  page a person is reading.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: Linking to a node from the menu writes the `see` the agent writes
    When I open the node menu of "handles"
    And I choose "More › Link to…" from the node menu
    Then the see panel is open on "handles"
    And the edge panel's search box asks for a Go key and no corrections
    When I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" seeing "compost"
    And the page has not reloaded
    And there should be no page errors

  Scenario: Enter does not take a row the query has already moved past
    When I open the node menu of "handles"
    And I choose "More › Link to…" from the node menu
    And I search the edge panel for "compost"
    When I retype the edge panel's search as "mint" and press Enter at once
    And the edge panel's rows answer "mint"
    Then "house.olai" holds the node "handles" seeing nothing
    When I press "Enter"
    Then "house.olai" holds the node "handles" seeing "mint"
    And there should be no page errors

  Scenario: The panel lists what the node says now, and its `×` takes one off
    When I open the node menu of "order"
    And I choose "More › Link to…" from the node menu
    Then the edge panel holds "herbs"
    When I drop "herbs" in the edge panel
    Then "house.olai" holds the node "order" seeing nothing
    And there should be no page errors

  Scenario: ⌘Z takes a link back, and ⌘⇧Z puts it back
    When I open the node menu of "handles"
    And I choose "More › Link to…" from the node menu
    And I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" seeing "compost"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" seeing nothing
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds the node "handles" seeing "compost"
    And there should be no page errors

  Scenario: A dependency declared from the menu blocks the row live
    Given the node "knobs" is not blocked
    When I open the node menu of "knobs"
    And I choose "More › Wait for…" from the node menu
    Then the after panel is open on "knobs"
    When I search the edge panel for "order the new cabinets"
    And I choose "order the new cabinets" from the edge panel
    Then "house.olai" holds the node "knobs" after "order"
    And the node "knobs" is blocked by "order"
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘Z takes a dependency back, and the row stops waiting
    When I open the node menu of "knobs"
    And I choose "More › Wait for…" from the node menu
    And I search the edge panel for "order the new cabinets"
    And I choose "order the new cabinets" from the edge panel
    Then "house.olai" holds the node "knobs" after "order"
    And the node "knobs" is blocked by "order"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds the node "knobs" after nothing
    And the node "knobs" is not blocked
    And there should be no page errors

  Scenario: ⌘Z after a × puts the target back — at the END of the list
    When I open the node "hinges"
    Then the node "hinges" comes after "choose the handles, order the new cabinets"
    When I drop "handles" from the drawn "after" of "hinges"
    Then "house.olai" holds the node "hinges" after "order"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "hinges" after "order, handles"
    And the node "hinges" comes after "order the new cabinets, choose the handles"
    And there should be no page errors

  Scenario: A loop is refused in the ops layer's own words, naming the loop
    When I open the node menu of "order"
    And I choose "More › Wait for…" from the node menu
    And I search the edge panel for "install the cabinets"
    And I choose "install the cabinets" from the edge panel
    Then the edge panel says "closes a loop"
    And the edge panel says "`order` → `install` → `order`"
    And "house.olai" holds the node "order" after "demo"
    And there should be no page errors

  Scenario: A zoomed node draws what it declares beside what is in its way
    When I open the node "hinges"
    Then the node "hinges" is blocked by "order"
    And the node "hinges" comes after "choose the handles, order the new cabinets"

  Scenario: The zoomed page's own verbs write both edges
    When I open the node "handles"
    And I open the after panel from the page
    And I search the edge panel for "the compost heap"
    And I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" after "compost"
    And the node "handles" comes after "the compost heap"
    And there should be no page errors

  Scenario: The `×` on a drawn `after` reference drops that dependency
    When I open the node "hinges"
    And I drop "order" from the drawn "after" of "hinges"
    Then "house.olai" holds the node "hinges" after "handles"
    And there should be no page errors

  Scenario: The `×` on a drawn `see` reference drops that link
    When I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I drop "herbs" from the drawn "see" of "order"
    Then "house.olai" holds the node "order" seeing nothing
    And the node "order" draws no "see"
    And there should be no page errors

  Scenario: A target named twice draws ONE link, and the page survives the frame
    When I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    Given I mark the page
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","see":["herbs","herbs","herbs"]}
      {"id":"walnut","parent":"order","ord":"a0","title":"walnut, six week lead time"}
      """
    Then the node "walnut" is shown
    And the node "order" sees exactly "the herb bed by the door"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A dependency named twice is one dependency, drawn and DERIVED
    When I open the node "hinges"
    Then the node "hinges" comes after "choose the handles, order the new cabinets"
    And the node "hinges" is blocked by exactly "order"
    Given I mark the page
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05"}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","after":["order"]}
      {"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}
      {"id":"hinges","parent":"install","ord":"a1","title":"pick the hinges","todo":"2026-08-11","after":["handles","order","order","order"]}
      {"id":"brass","parent":"hinges","ord":"a0","title":"brass, or nothing"}
      """
    Then the node "brass" is shown
    And the node "hinges" comes after "choose the handles, order the new cabinets"
    And the node "hinges" is blocked by exactly "order"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The panel's hits carry properties too, like every other door onto the search
    When I open the node menu of "hinges"
    And I choose "More › Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "hinges"
    When I open the node menu of "handles"
    And I choose "More › Link to…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "hinges"
    Then the edge panel hit "pick the hinges" shows the property "agent" holding "claude-opus"
    And there should be no page errors

  Scenario: the names the panel holds are words, not doors
    When I open the node menu of "handles"
    And I choose "More › Link to…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "garden"
    And I choose "garden #outdoors" from the edge panel
    Then the edge panel holds "garden"
    And the name the panel holds for "garden" styles the tag "#outdoors"
    When I press the tag "#outdoors" the panel's name for "garden" carries
    Then the edge panel holds "garden"
    And the address is exactly "/house.olai"
    And the page has not reloaded
    And there should be no page errors
