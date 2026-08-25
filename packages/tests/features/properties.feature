@share-scratch
@scratch:good
Feature: Properties on a node, from the web
  A property is a named fact on a node — `pr`, `agent`, `isbn` — kept in the
  record's one open field, `custom` (docs/format.md). An agent writes one with
  `set_prop`; this is the person's door onto the same op.

  They are read ON THE ROW, under its title, as a wrapping run of chips: the key
  small and muted, the value first-class. AUTO-SHOWN, whether the row is open or
  not — a fact behind a fold is a fact nobody reads, and these are short facts by
  rule, so the display's job is to make five of them cost one line rather than
  five. What the pilcrow opens is therefore the note, and only the note.

  A value that NAMES A THING is a link. A path in this directory opens that
  file's page, a value that is a node's id opens that node, a URL leaves the
  tab, and a date wears the date badge and opens that day. Everything else stays
  the text it is — a wrong door is worse than no door, so there is no fuzzy
  matching here and nothing is a link because it merely looks like one.

  A ROW draws the CUSTOM keys only. The node's own facts — its id, the mark it
  has, its date — are already on the row, in the glyph and on the date badge
  and in the address, so repeating them under the title would put two spellings
  of one fact on one screen. A page ABOUT one node still draws them all, which
  is where the id is read.

  A CHIP IS WHERE THE PROPERTY IS WRITTEN, in place: press its key — or its
  value, where that is not a link — type, and press Enter. Escape cancels;
  leaving commits what changed and is silent when nothing did; CLEARING the
  value removes the property, which is the op's own reading of an empty value
  rather than a gesture this face invented. A `+` at the end of the run adds
  one, and that is the only place a key is typed: a rename is a removal and an
  addition, which is two ops.

  Each is one edit at the same write gate the keys and the agent's tools go
  through, so nothing is echoed — the run changes when the file says it changed.

  THE `•••` MENU CARRIES ONE PROPERTY ENTRY, and only on a node that has none:
  it used to grow an `Edit <key>…` and a `Remove <key>` per property, a menu
  that got longer every time somebody wrote a fact down. Those are gone with the
  panel they opened. What is left is the case the `+` cannot reach — a node with
  no run to sit at the end of — so there is exactly one door at any moment and
  never two.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: The first one is added from the menu, and the row says so with no gesture at all
    # `handles` carries no property, so it has no run for a `+` to sit at the
    # end of — and this is the ONE entry the menu still carries about
    # properties.
    When I open the node menu of "handles"
    Then the node menu offers "Add property…"
    When I choose "Add property…" from the node menu
    # ...and the menu says NOTHING: an entry answers with what it has to say,
    # and opening a box has nothing to say.
    Then the node menu of "handles" says nothing
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179" on "handles"
    # THE WHOLE POINT: no pilcrow pressed, no row opened. The fact is on the row
    # the moment the file says it is.
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    # ...and the ADD was one gesture too: the value box's Enter closed the chip,
    # and the leaving the close fired sent nothing of its own.
    And the node "handles" says nothing about its properties
    # `handles` has no note, so it has nothing behind a mark — a run that is
    # already on the row is not something to open.
    And the node "handles" shows no pilcrow
    And the property editor on "handles" is closed
    And the page has not reloaded
    And there should be no page errors

  Scenario: A node that HAS one adds the next from the `+`, and the menu offers nothing
    # ONE DOOR AT A TIME. The `+` at the end of the run is the door wherever
    # there is a run; the menu entry is the door only where there is not.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"
    When I open the node menu of "handles"
    Then the node menu does not offer "Add property…"
    And the node menu does not offer "Edit agent…"
    And the node menu does not offer "Remove agent"
    When I press "Escape"
    And I add a property on "handles"
    And I write the property "stage" holding "review" on "handles"
    Then the properties on "handles" read "agent, stage"
    And "house.olai" holds the node "handles" with "stage" set to "review"
    And there should be no page errors

  Scenario: A chip is edited in place — press its key, type, press Enter
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "review"
    # A rename is a removal and an addition — two ops, which is exactly the two
    # calls an agent makes — so an existing chip's key is not typeable at all.
    And the property editor on "handles" offers no key box
    When I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    # ONE GESTURE, ONE COMMIT, and the commit owns the close: the blur the
    # unmount fires is Enter's own closing, not a second write — the day it is
    # heard as one, the ops layer's no-change guard draws "already says … —
    # nothing would change" here (chip-blur-double-commit-2).
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: Clicking away is the other commit — once, and as silently
    # The path the Enter fix could break: with NO key pressed, the blur IS the
    # gesture, so it must still write — once: a once-heard leaving is the law,
    # a silenced one is the cure being worse than the bug, and a twice-heard
    # one is the bug itself, spelled by the pointer instead of by Enter.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles" without pressing Enter
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: The same chip edited twice — every open answers for itself
    # THE REMOUNT, DRIVEN. The editor's answer-record is born with the open:
    # closing disposes the box and REOPENING mints the next editor, so the
    # second open's blur must still carry the gesture. An editor that kept
    # the first open's record (a hidden box instead of a disposed one) would
    # read this second leaving as the first Enter's echo and swallow it —
    # the typed "submitted" never sent, the file still saying "addressing":
    # the pinned bug reborn as a silent miss.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    # Second open, the other half of the rule: typed, then clicked away.
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "addressing"
    When I type "submitted" into the property editor on "handles" without pressing Enter
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "submitted"
    And "house.olai" holds the node "handles" with "stage" set to "submitted"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A value that is not a link is the second way in
    # The gesture rule, in the direction a reader reaches first. A link goes
    # where it says; everything else in a chip opens it.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I press the value of "stage" on "handles"
    Then the property editor on "handles" holds "review"
    And there should be no page errors

  Scenario: Clearing the value removes the property — the op's own reading
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    When I edit the property "stage" on "handles"
    And I type "" into the property editor on "handles"
    Then the node "handles" shows no property "stage"
    And "house.olai" holds the node "handles" with no "stage"
    # ...and the row is back to drawing nothing at all, rather than a run
    # holding only the facts nobody asked to see.
    And the node "handles" shows no drawer
    And the node "handles" shows no pilcrow
    And there should be no page errors

  Scenario: A chip opened while somebody else writes the same key does not put the old value back
    # grok's MUST. The box is filled from the value the chip was OPENED on, and
    # a commit is judged against that snapshot rather than against what the key
    # holds now — so a blur where nothing was typed writes nothing, even though
    # the file moved underneath. Judged against the live value instead, this
    # wrote the stale `review` back over the agent's word, silently.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    When I edit the property "stage" on "handles"
    Then the property editor on "handles" holds "review"
    # ...and now somebody else — an agent, another tab — moves the same key.
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"addressing"}}
      """
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    # THE CLAIM: the agent's word stands, on the row and on the disk, and
    # nothing was said — because nothing was written.
    And the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A value that names something keeps its link however long it is
    # Both reviewers. The fold is for PROSE; a URL and a deep vault path are the
    # two door kinds most likely to run past it, and folding them took away the
    # link the door rule had just given them. A name is one token however long.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"pr":"https://github.com/juspay/olai/pull/369#discussion_r1234567890","note":"a sentence long enough to be prose rather than a fact, which is what the fold is for"}}
      """
    And I open the outline "house.olai"
    # 61 characters and still a door.
    Then the property "pr" on "handles" is a "away" door to "https://github.com/juspay/olai/pull/369#discussion_r1234567890"
    And the property "pr" on "handles" is not folded
    # ...while prose of the same length is exactly what still folds.
    And the property "note" on "handles" is folded
    And there should be no page errors

  Scenario: A shadow custom key does not open an editor inside the system chip
    # pi's S2. `custom` is open all the way, so a hand-written record may carry
    # a custom `date` beside the FIELD of that name — a legal record that only
    # `set_prop` refuses to MAKE. Both chips are drawn on the node's own page.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","date":"2026-08-10","custom":{"date":"whenever the tiler is free"}}
      """
    And I open the node "handles"
    Then the zoomed node is "handles"
    # Pressing the CUSTOM chip's key opens exactly one box, and it is not the
    # system chip's — asked by the chip's own identity rather than its bare key.
    When I edit the custom property "date" on "handles"
    Then the property editor on "handles" holds "whenever the tiler is free"
    And exactly 1 property editor is open on "handles"
    And the system property "date" on "handles" offers no editor
    And there should be no page errors

  Scenario: A property holding a LIST is removed by clearing it
    # pi's S3. `set_prop` writes text, so a list can only be hand-written — but
    # REMOVAL is exact whatever the key held, which is why the deleted menu
    # offered `Remove <key>` on a list and no `Edit <key>…`. Excluding the chip
    # took the removal away with the edit.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"reviewers":["pi","grok"],"stage":"review"}}
      """
    And I open the outline "house.olai"
    And I mark the page
    Then the node "handles" shows the property "reviewers" holding "pi, grok"
    When I edit the property "reviewers" on "handles"
    # Seeded with the members joined, so committing it UNCHANGED writes nothing
    # and a list cannot be flattened by opening a chip and pressing Enter.
    Then the property editor on "handles" holds "pi, grok"
    When I click away from the property editor on "handles"
    Then the node "handles" shows the property "reviewers" holding "pi, grok"
    And the node "handles" says nothing about its properties
    # ...and clearing it takes the key off, exact whatever it held.
    When I edit the property "reviewers" on "handles"
    And I type "" into the property editor on "handles"
    Then the node "handles" shows no property "reviewers"
    And "house.olai" holds the node "handles" with no "reviewers"
    And there should be no page errors

  Scenario: Escape writes nothing, and neither does opening a chip and leaving it
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    When I edit the property "stage" on "handles"
    And I leave the property editor on "handles" without pressing Enter
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "review"
    And the node "handles" says nothing about its properties
    # Opening a chip and clicking away is a gesture somebody makes several times
    # a minute, and it must be silent rather than a refusal: the ops layer would
    # turn "set it to what it already holds" away in good words, and an
    # affordance that leads to a refusal is worse than none.
    When I edit the property "stage" on "handles"
    And I click away from the property editor on "handles"
    Then the property editor on "handles" is closed
    And the node "handles" shows the property "stage" holding "review"
    And the node "handles" says nothing about its properties
    And there should be no page errors

  Scenario: A row draws the custom keys, and the node's page draws them all
    # THE SPLIT, both halves in one scenario because they are one decision. On
    # a row the id would be a second spelling of what the bullet's link already
    # is; on a page ABOUT the node it is the whole reason the system half
    # exists, since an id is what every tool call takes.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "handles"
    Then the node "handles" shows the property "stage" holding "review"
    And the node "handles" shows no property "id"
    When I open the node "handles"
    Then the zoomed node is "handles"
    And the node "handles" shows the property "id" holding "handles"
    And the property "id" on "handles" is read-only
    And the node "handles" shows the property "stage" holding "review"
    # ...and the node's own page can write one now, which it never could: the
    # `•••` hangs off a ROW, so a zoomed heading had a drawer and no door to it.
    When I edit the property "stage" on "handles"
    And I type "addressing" into the property editor on "handles"
    Then the node "handles" shows the property "stage" holding "addressing"
    And "house.olai" holds the node "handles" with "stage" set to "addressing"
    And there should be no page errors

  Scenario: What the pilcrow adds is the note, and never what the row already shows
    # The question the auto-show ruling had to answer: does opening a row say
    # anything twice? It cannot — the run is not behind the mark.
    When I open the node menu of "order"
    And I choose "Add property…" from the node menu
    And I write the property "stage" holding "review" on "order"
    Then the node "order" shows the property "stage" holding "review"
    And the node "order" shows a pilcrow
    When I open the note of "order"
    Then the node "order" shows the property "stage" holding "review"
    And the row "order" is open
    And there should be no page errors

  # ── the doors ────────────────────────────────────────────────────────

  Scenario: A value that names a document in this directory opens that document
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the property "brief" on "handles" is a "document" door to "/finishes.md"
    When I follow the property "brief" on "handles"
    Then the address is "/finishes.md"
    And there should be no page errors

  Scenario: A value that IS a node's id opens that node — assignment becomes navigation
    # The exact-id rule, and the whole reason it can be trusted: `basil` is a
    # node `garden.olai` declares, so this is a match against the SET rather
    # than a guess about a word.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"reviewer":"basil"}}
      """
    And I open the outline "house.olai"
    Then the property "reviewer" on "handles" is a "node" door to "/#basil"
    When I follow the property "reviewer" on "handles"
    Then the zoomed node is "basil"
    And there should be no page errors

  Scenario: A date wears the date badge and opens its day
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"soak-until":"2026-08-10"}}
      """
    And I open the outline "house.olai"
    Then the property "soak-until" on "handles" is a "day" door to "/d/2026-08-10"
    When I follow the property "soak-until" on "handles"
    Then the address is "/d/2026-08-10"
    And there should be no page errors

  Scenario: A URL is a link out of the tab, and everything else stays text
    # Both halves in one scenario because they are one rule read in two
    # directions: the whole value IS the thing, or the value is not a door.
    # `claude-opus` is id-shaped and names no node; `merge` is a sentence; and
    # the `pr` here has a URL INSIDE it, which is not the same as being one.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"home":"https://example.invalid/one","agent":"claude-opus","merge":"the human approves","pr":"#179 https://example.invalid/one landed"}}
      """
    And I open the outline "house.olai"
    Then the property "home" on "handles" is a "away" door to "https://example.invalid/one"
    And the property "home" on "handles" opens in a tab of its own
    And the property "agent" on "handles" is not a link
    And the property "merge" on "handles" is not a link
    And the property "pr" on "handles" is not a link
    And there should be no page errors

  Scenario: The file's own key order stands, and nothing re-sorts it
    # A record a HAND wrote holds its keys in the order the person thought
    # about the lane in. Alphabetical is what olai's own WRITER produces, not
    # what a drawer imposes — so a run over a hand-written record reads as it
    # was written.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"worktree":".worktrees/pda","agent":"claude-opus","brief":"finishes.md"}}
      """
    And I open the outline "house.olai"
    Then the properties on "handles" read "worktree, agent, brief"
    And there should be no page errors

  Scenario: A value too long to be a fact is drawn as its first words
    # Move 3's fold, which is the safety net rather than the goal: props are
    # short facts by rule, and the fold is what stops a record that broke the
    # rule from putting the wall back on every row of the board.
    Given I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
      {"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review","verdict":"DO-NOT-OBJECT at c2704bc6 — the owner map verified against the diff, and the wait discipline holds"}}
      """
    And I open the outline "house.olai"
    Then the property "verdict" on "handles" is folded
    And the property "stage" on "handles" is not folded
    And the property "verdict" on "handles" reads "DO-NOT-OBJECT at c2704bc6 —"
    When I open the property "verdict" on "handles"
    Then the property "verdict" on "handles" reads "the wait discipline holds"
    And there should be no page errors

  @phone
  Scenario: The run and its editor work with a thumb, at 390 points
    # The `•••` is not drawn on a phone at all — a gutter that wide would leave
    # no room for the title — so the FIRST property is reached by the same long
    # press every other verb uses (`on_a_phone.feature`), and the ones after it
    # by the `+` on the row, which needs no hover and is a chip a thumb can hit.
    # The boxes keep the 44px a finger is given while a laptop does not pay for
    # it (`md:min-h-0`).
    When I hold a finger on the node "handles"
    Then the node menu is open
    When I tap "Add property…" in the node menu
    Then the property editor on "handles" fits the screen
    When I write the property "pr" holding "https://github.com/juspay/olai/pull/179" on "handles"
    Then the node "handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/179"
    And "house.olai" holds the node "handles" with "pr" set to "https://github.com/juspay/olai/pull/179"
    When I add a property on "handles"
    Then the property editor on "handles" fits the screen
    When I write the property "agent" holding "claude-opus" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"
    And there should be no page errors

  Scenario: The node's own facts have no entries in the menu
    # `order` carries a date, and the entry for it is `Change date…`. An
    # `Edit date…` beside it would be a second spelling of one write — and the
    # one `set_prop` refuses by name.
    When I open the node menu of "order"
    Then the node menu does not offer "Edit date…"
    And the node menu does not offer "Remove date"
    And the node menu does not offer "Remove id"
    And the node menu offers "Change date…"

  Scenario: A search result carries the properties, and says which one answered
    # The scenario PR #192 could not write. It put the whole `custom` map on a
    # hit and deliberately left the row alone, because "should a reader SEE a
    # hit's properties" was a product question nobody had ruled — so there was
    # nothing on screen to assert. It is ruled now, and this is the loop it
    # bought: write a fact on a node, then ask the header box for it and get the
    # fact back on the row, without opening anything.
    When I open the node menu of "handles"
    And I choose "Add property…" from the node menu
    And I write the property "agent" holding "claude-opus" on "handles"
    And I add a property on "handles"
    And I write the property "pr" holding "https://github.com/juspay/olai/pull/192" on "handles"
    Then the node "handles" shows the property "agent" holding "claude-opus"

    # The board's own query, asked by a person this time. The row draws both
    # properties — a hit carries the whole map — and marks the one the query
    # named, which leads so a narrow panel ellipsizes the others instead.
    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the node "choose the handles"
    And the header search result "choose the handles" shows the property "agent" holding "claude-opus"
    And the header search result "choose the handles" shows the property "pr" holding "https://github.com/juspay/olai/pull/192"
    And the header search result "choose the handles" marks "agent" as why it matched
    And there should be no page errors
