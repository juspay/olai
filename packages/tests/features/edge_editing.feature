@scratch:good
Feature: Writing a node's edges — `see` and `after`
  The web has DRAWN both edges since edges-ui: the `see` links under a node,
  and — for `after` — the dim on a row, the mark column's glyph and the
  `blocked by` line on a node's page. It could write neither. An agent could do
  both (`set_see`, `set_after`), so that was a standing consistency violation
  rather than a missing feature (HACKING.md: "MCP and Web ops must be
  consistent; never deviate").

  Two doors onto one op, and the same op either way: the `•••` menu's two
  verbs on a row, and — on a zoomed node, whose heading has no `•••` — two
  controls beside the rows they are about. Each opens a panel holding what the
  node says NOW, with an `×` on each, and the server's own node search for what
  to add. Nothing is echoed: a reference appears when the file says it does.

  And the refusals are the ops layer's own, verbatim. An `after` that would
  close a loop is refused NAMING the loop — the sentence an agent gets, on the
  page a person is reading.

  `@scratch:` because these write the directory they are served — each
  scenario gets a private copy of it.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  # ── `see`, from a row ───────────────────────────────────────────────

  Scenario: The `•••` menu offers both edge verbs, on every node
    # Not narrowed by what a node already carries: naming what a node points at
    # is a thing you do to a node that says nothing yet.
    When I open the node menu of "handles"
    Then the node menu offers "Link to a node…"
    And the node menu offers "Wait for a node…"

  Scenario: Linking to a node from the menu writes the `see` the agent writes
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" seeing "compost"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The panel lists what the node says now, and its `×` takes one off
    # The removal half, and the reason it is IN the panel: a tree row draws its
    # `see` links inside the note it expands, so a node with references and no
    # note has nowhere else to put an `×`.
    When I open the node menu of "order"
    And I choose "Link to a node…" from the node menu
    Then the edge panel holds "herbs"
    When I drop "herbs" in the edge panel
    Then "house.olai" holds the node "order" seeing nothing
    And there should be no page errors

  Scenario: ⌘Z takes a link back, and ⌘⇧Z puts it back
    # One stack, whichever hand made the edit — and the inverse of `see add` is
    # `see remove`, derived from the snapshot the write was judged against.
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.olai" holds the node "handles" seeing "compost"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.olai" holds the node "handles" seeing nothing
    When I press "ControlOrMeta+Shift+z"
    Then "house.olai" holds the node "handles" seeing "compost"
    And there should be no page errors

  Scenario: An edge chosen at a MIRROR lands on the node it shows
    # The standing routing rule for everything a node SAYS — a placement's own
    # record cannot carry an edge at all.
    When I open the node menu of "kitchen-herbs"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "garden.olai" holds the node "herbs" seeing "compost"
    And there should be no page errors

  # ── `after`, and the loop it refuses to close ───────────────────────

  Scenario: A dependency declared from the menu blocks the row live
    # Nothing is in `knobs`' way until it is said to be, and then something is
    # — with no reload, because the file is what said so. `order` is `doing`,
    # so it is work that can stand in the way; the derived index is what draws
    # the row, and it moved because the FIELD did.
    Given the node "knobs" is not blocked
    When I open the node menu of "knobs"
    And I choose "Wait for a node…" from the node menu
    Then the after panel is open on "knobs"
    When I search the edge panel for "order the new cabinets"
    And I choose "order the new cabinets" from the edge panel
    Then "house.olai" holds the node "knobs" after "order"
    And the node "knobs" is blocked by "order"
    And the page has not reloaded
    And there should be no page errors

  Scenario: ⌘Z takes a dependency back, and the row stops waiting
    # The other relation's undo, which is the same arm read the other way: the
    # inverse of `after add` is `after remove`, narrowed on the server to what
    # the write actually changed. And the row is the proof it reached the FILE
    # — blockedness is derived, so a dim that lifts is the set answering.
    When I open the node menu of "knobs"
    And I choose "Wait for a node…" from the node menu
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
    # THE DOCUMENTED RESIDUAL, pinned as behaviour rather than left as prose.
    # `hinges` declares `handles` then `order`; dropping the FIRST and taking
    # that back re-adds it, and `set_see`/`set_after` are incremental — an add
    # APPENDS — so it comes back last. The relation is the same set either way,
    # which is why this is a residual and not a bug; closing it would mean a
    # whole-array write on both faces, a change to the op rather than to an
    # undo. A scenario asserting only membership could not tell the two apart,
    # so this one asserts the order.
    When I open the node "hinges"
    Then the node "hinges" comes after "choose the handles, order the new cabinets"
    When I drop "handles" from the drawn "after" of "hinges"
    Then "house.olai" holds the node "hinges" after "order"
    When I press "ControlOrMeta+z"
    Then "house.olai" holds the node "hinges" after "order, handles"
    And the node "hinges" comes after "order the new cabinets, choose the handles"
    And there should be no page errors

  Scenario: A loop is refused in the ops layer's own words, naming the loop
    # `install` already comes after `order`. Asking for `order` after `install`
    # would close `order → install → order`, and what a person reads is the
    # sentence `set_after` gives an agent — never a summary, and never a
    # silently disabled row.
    When I open the node menu of "order"
    And I choose "Wait for a node…" from the node menu
    And I search the edge panel for "install the cabinets"
    And I choose "install the cabinets" from the edge panel
    Then the edge panel says "closes a loop"
    And the edge panel says "`order` → `install` → `order`"
    And "house.olai" holds the node "order" after "demo"
    And there should be no page errors

  # ── the zoomed node, which has no `•••` at all ──────────────────────

  Scenario: A zoomed node draws what it declares beside what is in its way
    # Two different claims, and the fixture tells them apart: `hinges` DECLARES
    # it comes after both `handles` and `order`, and only `order` is in its way
    # — `handles` carries no mark, so it is not work and never blocks. The
    # derived row cannot be the editable one, which is why there are two.
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
    # The other relation through the other door, and the row goes with the
    # field: a `see` row is drawn only while the node carries one.
    When I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I drop "herbs" from the drawn "see" of "order"
    Then "house.olai" holds the node "order" seeing nothing
    And the node "order" draws no "see"
    And there should be no page errors
