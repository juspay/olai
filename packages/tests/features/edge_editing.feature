@share-scratch
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

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.org"
    And I mark the page

  Scenario: Linking to a node from the menu writes the `see` the agent writes
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.org" holds the node "handles" seeing "compost"
    And the page has not reloaded
    And there should be no page errors

  # A shortlist HOLDS STILL through a settle and a round trip — the rows a
  # reader is looking at stay until the next ones arrive, which is the only
  # honest thing to draw. It is not an honest thing to WRITE from: `Enter`
  # inside that window took the row the LAST query found, and a take here puts
  # a `see` on somebody's node
  # (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md`'s 4.12).
  Scenario: Enter does not take a row the query has already moved past
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    When I retype the edge panel's search as "mint" and press Enter at once
    # Waited out whole: by the time the rows answer the new query, anything
    # that key wrongly sent has landed and the disk would say so.
    And the edge panel's rows answer "mint"
    Then "house.org" holds the node "handles" seeing nothing
    # ...and the key is not lost to the reader, only to the wrong row: pressed
    # again, over rows that are theirs, it takes the one they were looking at.
    When I press "Enter"
    Then "house.org" holds the node "handles" seeing "mint"
    And there should be no page errors

  Scenario: The panel lists what the node says now, and its `×` takes one off
    # The removal half, and the reason it is IN the panel: a tree row draws its
    # `see` links inside the note it expands, so a node with references and no
    # note has nowhere else to put an `×`.
    When I open the node menu of "order"
    And I choose "Link to a node…" from the node menu
    Then the edge panel holds "herbs"
    When I drop "herbs" in the edge panel
    Then "house.org" holds the node "order" seeing nothing
    And there should be no page errors

  Scenario: ⌘Z takes a link back, and ⌘⇧Z puts it back
    # One stack, whichever hand made the edit — and the inverse of `see add` is
    # `see remove`, derived from the snapshot the write was judged against.
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    And I search the edge panel for "compost"
    And I choose "the compost heap" from the edge panel
    Then "house.org" holds the node "handles" seeing "compost"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.org" holds the node "handles" seeing nothing
    When I press "ControlOrMeta+Shift+z"
    Then "house.org" holds the node "handles" seeing "compost"
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
    Then "house.org" holds the node "knobs" after "order"
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
    Then "house.org" holds the node "knobs" after "order"
    And the node "knobs" is blocked by "order"
    When I press "Escape"
    And I press "ControlOrMeta+z"
    Then "house.org" holds the node "knobs" after nothing
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
    Then "house.org" holds the node "hinges" after "order"
    When I press "ControlOrMeta+z"
    Then "house.org" holds the node "hinges" after "order, handles"
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
    And "house.org" holds the node "order" after "demo"
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
    Then "house.org" holds the node "handles" after "compost"
    And the node "handles" comes after "the compost heap"
    And there should be no page errors

  Scenario: The `×` on a drawn `after` reference drops that dependency
    When I open the node "hinges"
    And I drop "order" from the drawn "after" of "hinges"
    Then "house.org" holds the node "hinges" after "handles"
    And there should be no page errors

  Scenario: The `×` on a drawn `see` reference drops that link
    # The other relation through the other door, and the row goes with the
    # field: a `see` row is drawn only while the node carries one.
    When I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    When I drop "herbs" from the drawn "see" of "order"
    Then "house.org" holds the node "order" seeing nothing
    And the node "order" draws no "see"
    And there should be no page errors

  # ── a file that names one target twice ──────────────────────────────

  Scenario: A target named twice draws ONE link, and the page survives the frame
    # A `.org` is plain text and a hand-edited one can say the same thing twice.
    # What it MEANS is the write layer's own answer: `set_see` and `set_after`
    # treat these fields as SETS — re-adding a target the node already names is
    # a silent no-op — so a file naming one target three times names it once,
    # and the page draws one link (ruled by the human, 2026-08-16).
    #
    # Which is not a cosmetic question, and this is the half that took a page
    # down. The row is keyed by the TARGET id, honest only while a target
    # appears once: three links under one key are ONE element handed to the
    # framework three times, and the next store frame's list reconciliation runs
    # off the end of the array it is patching and dies reading `remove` of
    # undefined — mid-draw, the whole page, the identical stack #202 fixed for
    # the chat panel's diff blocks.
    #
    # So the write lands with the page already open on the node: the row holds
    # one link and the frame brings three, which is the smallest shape that
    # crashes.
    When I open the node "order"
    Then the node "order" sees "herbs" as "the herb bed by the door"
    # Marked HERE rather than in the Background: opening a node's page is a
    # navigation, so the mark that outlives this write has to be planted on the
    # document the write arrives at.
    Given I mark the page
    When I rewrite "house.org" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","see":["herbs","herbs","herbs"]}
      {"id":"walnut","parent":"order","ord":"a0","title":"walnut, six week lead time"}
      """
    # The new row is what makes this a REPRODUCTION rather than a photograph of
    # the page as it already was: it is asked for first, so the frame carrying
    # the repeated target has demonstrably reached the open page before anything
    # below is asked. A page that died drawing that frame takes this step with
    # it.
    Then the node "walnut" is shown
    And the node "order" sees exactly "the herb bed by the door"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A dependency named twice is one dependency, drawn and DERIVED
    # The same file shape on the other writable field, and it reaches one row
    # further: `after` is drawn twice on a node's page — the FIELD, as the node
    # declares it, and `blocked by`, which the set derives from it. Both are the
    # same labelled row of links, so both were the same crash, and the second
    # one is not fixed by reading the field as a set: `blocks` is folded into
    # the ordering graph there, and an edge named twice — by one field naming a
    # target twice, or by both spellings naming it once — was two edges to the
    # same node.
    #
    # `hinges` declares `after: [handles, order]` and only `order` is in its way
    # (`handles` carries no mark, so it is not work and never blocks). The
    # rewrite says `order` three times over: the FIELD row must still read both
    # targets once each, in the order the file names them, and the derived row
    # must still name one blocker.
    When I open the node "hinges"
    Then the node "hinges" comes after "choose the handles, order the new cabinets"
    And the node "hinges" is blocked by exactly "order"
    Given I mark the page
    When I rewrite "house.org" as:
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
    # FOUR surfaces draw one row (`client/search/Result.tsx`) over one
    # `createNodeSearch`: the ⌘K palette, the header's box, the `((` widget and
    # this panel. The properties reached the first two and stopped, which is
    # exactly the drift the one-reading doctrine is about — so this is the door
    # furthest from where they landed, holding the line.
    When I open the node menu of "hinges"
    And I choose "Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "hinges"
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "hinges"
    Then the edge panel hit "pick the hinges" shows the property "agent" holding "claude-opus"
    And there should be no page errors

  Scenario: the names the panel holds are words, not doors
    # Every name the panel holds is a TITLE, and a title is run through the
    # one pipeline: the chip for `garden` wears its `#outdoors` as the pill,
    # in its own hue. The chip is a FACT though — its one gesture is its `×`
    # — so the pill's press must not be the page's business either: the
    # filter router lives a span of DOM under the panel, and an unclaimed
    # press would narrow the tree out from under an open write. The chip
    # claims the press; the page's filter is the witness.
    When I open the node menu of "handles"
    And I choose "Link to a node…" from the node menu
    Then the see panel is open on "handles"
    When I search the edge panel for "garden"
    And I choose "garden #outdoors" from the edge panel
    Then the edge panel holds "garden"
    And the name the panel holds for "garden" styles the tag "#outdoors"
    When I press the tag "#outdoors" the panel's name for "garden" carries
    Then the edge panel holds "garden"
    And the address is exactly "/house.org"
    And the page has not reloaded
    And there should be no page errors
